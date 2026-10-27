from __future__ import annotations

"""
/api/v1/predict  —  Full multi-model prediction pipeline endpoint
==================================================================
This single endpoint orchestrates the entire AI pipeline:

    1. Open-Meteo       → fetch past 24hr rainfall sequence
    2. LSTMForecaster   → predict next-hour rainfall
    3. OSMService       → fetch hydrology / infra features
    4. DEMService       → fetch terrain (elevation, slope)
    5. SoilService      → soil moisture / permeability
    6. XGBoostPredictor → per-cell flood probability
    7. UNetSegmentor    → flood inundation mask (if satellite image provided)
    8. FloodRiskFusion  → spatial overlay → affected areas
    9. DecisionEngine   → severity, alerts, evacuation routes

The result is a comprehensive GeoJSON + decision payload that the
React dashboard and Flutter app consume directly.
"""
import json
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, HTTPException, Query

from app.config import settings
from app.services.osm_service import OSMService
from app.services.dem_service import DEMService
from app.services.rainfall_service import RainfallService
from app.services.soil_service import SoilService
from app.utils.grid import create_grid

from app.ai.lstm_forecaster import LSTMForecaster
from app.ai.xgboost_predictor import XGBoostPredictor, FEATURE_COLUMNS
from app.ai.unet_segmentor import UNetSegmentor

from app.gis.flood_risk_fusion import FloodRiskFusion
from app.services.decision_engine import DecisionEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["predict"])

# In-memory prediction cache for fast (<10ms) responses and low memory footprint
_PREDICT_CACHE = {}
_PREDICT_TIMESTAMPS = {}
CACHE_TTL = 900  # 15 minutes

# Singletons – loaded once at startup
osm_service = OSMService()
dem_service = DEMService()
rainfall_service = RainfallService()
soil_service = SoilService()

lstm = LSTMForecaster()
xgb_predictor = XGBoostPredictor()
unet = UNetSegmentor()
fusion = FloodRiskFusion()
decision = DecisionEngine()


@router.post("/predict")
async def predict_flood_risk(
    district_name: str = Query(..., description='e.g. "Chennai"'),
    include_unet: bool = Query(False, description="Run U-Net segmentation (requires satellite image)"),
    satellite_image: Optional[List] = Body(None, description="Pre-processed image array (H×W×C) as nested list"),
):
    """
    Full AI prediction pipeline for a district (cached for fast delivery).
    """
    cache_key = f"{district_name.strip().lower()}_{include_unet}"
    now_t = time.time()
    if cache_key in _PREDICT_CACHE and (now_t - _PREDICT_TIMESTAMPS.get(cache_key, 0)) < CACHE_TTL:
        logger.info("Serving cached predict response for %s", district_name)
        return _PREDICT_CACHE[cache_key]

    place = f"{district_name}, India" if "india" not in district_name.lower() else district_name

    # ── 1. Static GIS layers ──────────────────────────────────────────
    osm_data = osm_service.fetch_district_data(place)
    if osm_data is None:
        raise HTTPException(404, f"Could not resolve '{district_name}' on OpenStreetMap")

    bounds = tuple(osm_data["boundary"].total_bounds)
    grid = create_grid(bounds, cell_size_m=settings.GRID_SIZE_METERS)
    grid = osm_service.calculate_features(grid, osm_data)

    dem_src = dem_service.fetch_dem(bounds)
    grid = dem_service.calculate_terrain_features(grid, dem_src)

    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2

    # ── 2. Dynamic weather layer ──────────────────────────────────────
    rainfall = await rainfall_service.get_forecast(center_lat, center_lon)
    soil = soil_service.get_soil_properties(center_lat, center_lon)
    soil_moisture_pct = rainfall.get("soil_moisture_pct", 50.0)

    # ── 3. LSTM → flood risk probability ──────────────────────────────
    #    Build 7-day daily rainfall from Open-Meteo hourly data, then
    #    let the LSTM produce a temporal flood risk score (0–1).
    hourly_precip = rainfall.get("hourly_precipitation", [])
    if len(hourly_precip) >= 24 * 7:
        # Aggregate hourly → daily totals for the past 7 days
        daily_rain = [
            sum(hourly_precip[i * 24:(i + 1) * 24])
            for i in range(len(hourly_precip) // 24)
        ][-7:]  # last 7 complete days
    else:
        # Fallback: repeat current rainfall as daily estimate
        daily_rain = [rainfall.get("current_rainfall_mm", 0.0)] * 7

    lstm_flood_risk = lstm.predict_simple(daily_rain, soil_moisture=soil_moisture_pct)
    logger.info("LSTM flood risk: %.3f", lstm_flood_risk)

    # ── 4. Enrich grid for XGBoost ────────────────────────────────────
    #    Use the actual current rainfall (not LSTM output) as the
    #    rain_forecast_mm feature for XGBoost.
    current_rain = rainfall.get("current_rainfall_mm", 0.0)
    grid = fusion.enrich_grid_with_forecast(grid, current_rain, soil_moisture_pct)

    # Attach soil columns from SoilService
    for key, val in soil.items():
        grid[f"soil_{key}"] = val

    # ── 5. XGBoost → per-cell spatial flood probability ───────────────
    import pandas as pd  # noqa: PLC0415

    feature_df = pd.DataFrame({
        "rain_forecast_mm": grid.get("rain_forecast_mm", pd.Series([current_rain] * len(grid))),
        "elevation_m": grid.get("elevation_m", pd.Series([500.0] * len(grid))),
        "slope_deg": grid.get("slope_deg", pd.Series([5.0] * len(grid))),
        "dist_to_river_m": grid.get("dist_to_river_m", pd.Series([1000.0] * len(grid))),
        "soil_moisture_pct": grid.get("soil_moisture_pct", pd.Series([soil_moisture_pct] * len(grid))),
        "drainage_density": grid.get("drainage_density", pd.Series([0.0] * len(grid))),
        "soil_clay_pct": grid.get("soil_soil_clay_pct", pd.Series([soil.get("clay_pct", 30.0)] * len(grid))),
        "soil_permeability": grid.get("soil_soil_permeability", pd.Series([soil.get("permeability", 0.5)] * len(grid))),
    })
    xgb_flood_proba = xgb_predictor.predict_proba(feature_df)

    # ── Ensemble: LSTM (temporal) + XGBoost (spatial) ─────────────────
    #    LSTM captures "is it going to flood based on recent rain trends?"
    #    XGBoost captures "how vulnerable is this specific cell?"
    #    Final = weighted blend of both signals.
    import numpy as np  # noqa: PLC0415
    LSTM_WEIGHT = 0.35
    XGB_WEIGHT = 0.65
    grid["flood_probability"] = np.clip(
        LSTM_WEIGHT * lstm_flood_risk + XGB_WEIGHT * xgb_flood_proba,
        0.0, 1.0,
    )
    grid["risk_level"] = pd.cut(
        grid["flood_probability"],
        bins=[0, 0.25, 0.45, 0.65, 0.85, 1.01],
        labels=["MINIMAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
        right=False,
    ).astype(str)

    # ── 6. U-Net → flood inundation mask (optional) ───────────────────
    flood_polygons_geojson = None
    flood_polygons_gdf = None
    if include_unet and satellite_image is not None:
        import numpy as np  # noqa: PLC0415

        img_arr = np.array(satellite_image, dtype=np.float32)
        mask = unet.segment(img_arr)
        flood_polygons_gdf = fusion.mask_to_polygons(mask, bounds)
        if not flood_polygons_gdf.empty:
            flood_polygons_geojson = json.loads(flood_polygons_gdf.to_json())

    # ── 7. GIS overlay → affected areas ───────────────────────────────
    affected = fusion.find_affected_areas(
        flood_polygons_gdf if flood_polygons_gdf is not None else __import__("geopandas").GeoDataFrame(geometry=[]),
        villages=None,   # TODO: load from PostGIS / Bhuvan boundary once available
        hospitals=osm_data.get("hospitals"),
        shelters=osm_data.get("shelters"),
        roads=osm_data.get("roads"),
    )

    # ── 8. Decision Engine ────────────────────────────────────────────
    risk_scores = grid["flood_probability"].tolist()
    severity = decision.flood_severity_score(risk_scores)
    infra_risk = decision.infrastructure_risk(
        affected.get("affected_hospitals", []), affected
    )
    priorities = decision.compute_rescue_priorities(grid, affected)
    evac_routes = decision.evacuation_routes(
        affected.get("affected_villages", []),
        affected.get("evacuation_assets", []),
    )
    auto_alerts = decision.generate_alerts(district_name, severity, priorities)

    # ── 9. Assemble response ──────────────────────────────────────────
    risk_map_geojson = json.loads(grid.to_json())
    risk_distribution = grid["risk_level"].value_counts().to_dict()

    return {
        "district": district_name,
        "risk_map": {
            "type": "FeatureCollection",
            "features": risk_map_geojson["features"],
        },
        "flood_polygons": flood_polygons_geojson,
        "severity": severity,
        "affected_areas": {
            **affected,
            "infrastructure": infra_risk,
        },
        "rescue_priorities": priorities,
        "evacuation_routes": evac_routes,
        "alerts": auto_alerts,
        "pipeline_metadata": {
            "district": district_name,
            "grid_size_m": settings.GRID_SIZE_METERS,
            "total_cells": len(grid),
            "lstm_flood_risk": round(lstm_flood_risk, 3),
            "current_rainfall_mm": round(current_rain, 2),
            "soil_moisture_pct": round(soil_moisture_pct, 1),
            "ensemble_weights": {"lstm": LSTM_WEIGHT, "xgboost": XGB_WEIGHT},
            "risk_distribution": risk_distribution,
            "unet_enabled": include_unet,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models_used": ["LSTM (Keras)", "XGBoost", "U-Net" if include_unet else None],
        },
    }
    _PREDICT_CACHE[cache_key] = payload
    _PREDICT_TIMESTAMPS[cache_key] = time.time()
    return payload


@router.get("/infrastructure-risk")
async def get_infrastructure_risk(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_m: int = Query(5000, description="Search radius in metres"),
):
    """
    Point-level infrastructure risk snapshot: hospitals and shelters
    within `radius_m` of the given coordinates, with their flood risk
    from the nearest grid cell.
    """
    from app.utils.grid import bbox_from_point  # noqa: PLC0415

    bounds = bbox_from_point(lat, lon, radius_m)
    osm_data = osm_service.fetch_district_data(f"{lat},{lon}")  # rough label
    if osm_data is None:
        return {"hospitals": [], "shelters": [], "message": "No OSM data for this location"}

    return {
        "location": {"lat": lat, "lon": lon, "radius_m": radius_m},
        "hospitals": len(osm_data.get("hospitals", [])),
        "shelters": len(osm_data.get("shelters", [])),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
