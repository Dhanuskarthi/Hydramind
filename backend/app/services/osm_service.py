from __future__ import annotations
"""
OpenStreetMap layer.

OSM gives us STATIC infrastructure/hydrology only:
rivers, streams, drains, buildings, roads, hospitals, shelters.
It never provides rainfall or any real-time data - that comes from
rainfall_service.py.
"""
import logging
import geopandas as gpd
import osmnx as ox

logger = logging.getLogger(__name__)


class OSMService:
    def fetch_district_data(self, place_name: str) -> dict | None:
        """Download the OSM layers needed for flood-risk features."""
        try:
            boundary = ox.geocode_to_gdf(place_name)

            rivers = self._safe_features(place_name, {"waterway": ["river", "stream"]})
            drainage = self._safe_features(place_name, {"waterway": ["drain", "ditch", "canal"]})
            buildings = self._safe_features(place_name, {"building": True})
            roads = self._safe_features(place_name, {"highway": True})
            hospitals = self._safe_features(place_name, {"amenity": "hospital"})
            shelters = self._safe_features(
                place_name, {"amenity": ["shelter", "community_centre", "school"]}
            )

            return {
                "boundary": boundary,
                "rivers": rivers,
                "drainage": drainage,
                "buildings": buildings,
                "roads": roads,
                "hospitals": hospitals,
                "shelters": shelters,
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSM fetch failed for %s: %s", place_name, exc)
            return None

    @staticmethod
    def _safe_features(place_name: str, tags: dict):
        """osmnx raises when nothing is found - normalise that to an empty GeoDataFrame."""
        try:
            return ox.features_from_place(place_name, tags=tags)
        except Exception:  # noqa: BLE001
            return gpd.GeoDataFrame(geometry=[])

    def calculate_features(self, grid: gpd.GeoDataFrame, osm_data: dict) -> gpd.GeoDataFrame:
        """Attach distance/density columns to every grid cell."""
        if osm_data is None:
            return grid

        grid = grid.copy()
        centroids = grid.geometry.centroid

        grid["dist_to_river_m"] = self._distance_to_nearest(centroids, osm_data.get("rivers"))
        grid["dist_to_drain_m"] = self._distance_to_nearest(centroids, osm_data.get("drainage"))
        grid["dist_to_hospital_m"] = self._distance_to_nearest(centroids, osm_data.get("hospitals"))
        grid["dist_to_shelter_m"] = self._distance_to_nearest(centroids, osm_data.get("shelters"))

        grid["drainage_density"] = self._density_per_cell(grid, osm_data.get("drainage"))
        grid["building_density"] = self._density_per_cell(grid, osm_data.get("buildings"), is_lines=False)
        grid["road_density"] = self._density_per_cell(grid, osm_data.get("roads"))

        return grid

    @staticmethod
    def _distance_to_nearest(centroids, features: gpd.GeoDataFrame | None):
        if features is None or len(features) == 0:
            return [None] * len(centroids)
        # degrees -> rough meters (fine at this scale, good enough for risk scoring)
        union = features.geometry.unary_union
        return [pt.distance(union) * 111_000 for pt in centroids]

    @staticmethod
    def _density_per_cell(grid: gpd.GeoDataFrame, features: gpd.GeoDataFrame | None, is_lines: bool = True):
        if features is None or len(features) == 0:
            return [0.0] * len(grid)

        try:
            # Memory protection: cap features at 10k to avoid OOM on dense cities
            feat = features.reset_index(drop=True)
            if len(feat) > 10_000:
                feat = feat.sample(n=10_000, random_state=42)

            joined = gpd.sjoin(
                feat, grid[["grid_id", "geometry"]], how="inner", predicate="intersects"
            )
            counts = joined.groupby("grid_id").size()
            return grid["grid_id"].map(counts).fillna(0.0).tolist()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Density calculation failed (likely OOM): %s", exc)
            return [0.0] * len(grid)
