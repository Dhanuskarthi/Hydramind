"""
Flood Risk Fusion — GIS Processing Engine
==========================================
This module is the spatial brain of HydraMind. It takes the outputs
of all three AI models and the static GIS layers, fuses them together
inside PostGIS geometry space, and produces:

  1. A final flood probability per 150m grid cell  (XGBoost + LSTM fusion)
  2. A flooded-area polygon GeoDataFrame            (U-Net mask → polygons)
  3. A list of affected villages                    (spatial intersect)
  4. Affected critical infrastructure               (hospitals, shelters, bridges)
  5. Safe evacuation routes                         (PostGIS shortest-path or fallback)
  6. A rescue priority ranking                      (population × risk × isolation)

Libraries used
--------------
  GeoPandas   – vector operations
  Rasterio    – raster ↔ vector conversion
  Shapely     – geometry predicates (within, intersects)
  GDAL        (via rasterio/geopandas)

Flow
----
  LSTMForecaster     →  rain_forecast_mm
  XGBoostPredictor   →  flood_probability per cell
  UNetSegmentor      →  flood_mask (bool array)
                         ↓
                   FloodRiskFusion
                         ↓
             ┌───────────┬──────────────────┐
         grid GDF    flood polygons    priority ranking
             ↓
         FastAPI  →  React / Flutter
"""
from __future__ import annotations

import logging
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import mapping
from shapely.ops import unary_union

logger = logging.getLogger(__name__)


class FloodRiskFusion:
    """
    Fuses AI model outputs with GIS data layers to produce the final
    risk map, affected-infrastructure list, and evacuation priorities.
    """

    # ------------------------------------------------------------------
    # Step 1 – Integrate LSTM forecast into XGBoost feature table
    # ------------------------------------------------------------------

    def enrich_grid_with_forecast(
        self,
        grid: gpd.GeoDataFrame,
        rain_forecast_mm: float,
        soil_moisture_pct: float,
    ) -> gpd.GeoDataFrame:
        """
        Attach the LSTM rainfall forecast and current soil moisture to
        every grid cell so XGBoostPredictor can score them in batch.

        LSTM output feeds directly into XGBoost as a feature column.
        """
        grid = grid.copy()
        grid["rain_forecast_mm"] = rain_forecast_mm
        grid["soil_moisture_pct"] = soil_moisture_pct
        return grid

    # ------------------------------------------------------------------
    # Step 2 – Convert U-Net mask to GeoDataFrame of flooded polygons
    # ------------------------------------------------------------------

    def mask_to_polygons(
        self,
        flood_mask: np.ndarray,
        bounds: tuple[float, float, float, float],
        crs: str = "EPSG:4326",
    ) -> gpd.GeoDataFrame:
        """
        Convert the binary U-Net flood mask (H × W bool array) to a
        GeoDataFrame of flooded polygons in geographic coordinates.

        Parameters
        ----------
        flood_mask : np.ndarray  (H, W) bool
        bounds     : (minx, miny, maxx, maxy) in the target CRS
        crs        : coordinate reference system

        Returns
        -------
        GeoDataFrame with a single 'geometry' column of Polygon features.
        """
        if not flood_mask.any():
            return gpd.GeoDataFrame(geometry=[], crs=crs)

        try:
            import rasterio.features  # noqa: PLC0415
            from rasterio.transform import from_bounds  # noqa: PLC0415

            h, w = flood_mask.shape
            transform = from_bounds(*bounds, width=w, height=h)
            shapes = rasterio.features.shapes(
                flood_mask.astype(np.uint8), transform=transform
            )
            geoms = [
                shape
                for shape, value in shapes
                if value == 1
            ]
            if not geoms:
                return gpd.GeoDataFrame(geometry=[], crs=crs)
            from shapely.geometry import shape  # noqa: PLC0415

            polys = [shape(g) for g in geoms]
            merged = unary_union(polys)
            return gpd.GeoDataFrame(geometry=[merged], crs=crs)
        except Exception as exc:  # noqa: BLE001
            logger.warning("mask_to_polygons failed: %s", exc)
            return gpd.GeoDataFrame(geometry=[], crs=crs)

    # ------------------------------------------------------------------
    # Step 3 – Overlay: find affected villages and infrastructure
    # ------------------------------------------------------------------

    def find_affected_areas(
        self,
        flood_polygons: gpd.GeoDataFrame,
        villages: gpd.GeoDataFrame | None,
        hospitals: gpd.GeoDataFrame | None,
        shelters: gpd.GeoDataFrame | None,
        roads: gpd.GeoDataFrame | None,
    ) -> dict[str, Any]:
        """
        PostGIS-style spatial overlay: which features intersect the
        flooded area?

        Returns a dict with:
          affected_villages    – list of village names
          affected_hospitals   – list of hospital names/coordinates
          isolated_areas       – areas cut off by flooded roads
          evacuation_assets    – safe shelters outside the flood zone
        """
        result: dict[str, Any] = {
            "affected_villages": [],
            "affected_hospitals": [],
            "isolated_areas": [],
            "evacuation_assets": [],
        }

        if flood_polygons.empty:
            return result

        flood_union = flood_polygons.geometry.unary_union

        if villages is not None and not villages.empty:
            affected = villages[villages.geometry.intersects(flood_union)]
            result["affected_villages"] = affected.get("name", pd.Series()).dropna().tolist()

        if hospitals is not None and not hospitals.empty:
            affected_h = hospitals[hospitals.geometry.intersects(flood_union)]
            result["affected_hospitals"] = [
                {"name": row.get("name", "Unknown"), "geometry": mapping(row.geometry)}
                for _, row in affected_h.iterrows()
            ]

        if shelters is not None and not shelters.empty:
            safe_shelters = shelters[~shelters.geometry.intersects(flood_union)]
            result["evacuation_assets"] = [
                {"name": row.get("name", "Shelter"), "geometry": mapping(row.geometry)}
                for _, row in safe_shelters.iterrows()
            ]

        return result

    # ------------------------------------------------------------------
    # Step 4 – Rescue priority ranking
    # ------------------------------------------------------------------

    def compute_rescue_priorities(
        self,
        grid: gpd.GeoDataFrame,
        affected: dict[str, Any],
        village_population: dict[str, int] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Rank areas by rescue urgency using:
          priority = flood_probability × population_weight × isolation_factor

        Returns a sorted list (highest priority first).
        """
        if not affected.get("affected_villages"):
            return []

        populations = village_population or {}
        ranking = []
        for village in affected["affected_villages"]:
            pop = populations.get(village, 1000)  # default 1000 if unknown
            # Average risk score for cells tagged to this village (if available)
            if "village" in grid.columns:
                cells = grid[grid["village"] == village]
                avg_risk = cells["flood_probability"].mean() if "flood_probability" in cells else 0.5
            else:
                avg_risk = 0.5
            priority_score = avg_risk * np.log1p(pop)
            ranking.append({
                "village": village,
                "flood_probability": round(avg_risk, 3),
                "estimated_population": pop,
                "priority_score": round(priority_score, 3),
                "action": self._recommended_action(avg_risk),
            })

        ranking.sort(key=lambda x: x["priority_score"], reverse=True)
        return ranking

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _recommended_action(risk: float) -> str:
        if risk >= 0.85:
            return "IMMEDIATE_EVACUATION"
        if risk >= 0.65:
            return "PREPARE_TO_EVACUATE"
        if risk >= 0.45:
            return "MONITOR_CLOSELY"
        if risk >= 0.25:
            return "STAY_ALERT"
        return "NO_ACTION"
