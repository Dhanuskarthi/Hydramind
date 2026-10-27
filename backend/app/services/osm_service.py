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

# Protect Render from hanging on slow Overpass API calls (default is 180s!)
try:
    ox.settings.timeout = 10
    ox.settings.requests_timeout = 10
except Exception:
    pass


class OSMService:
    def __init__(self):
        self._cache = {}

    def fetch_district_data(self, place_name: str) -> dict | None:
        """Download the OSM layers needed for flood-risk features with in-memory caching."""
        cache_key = place_name.strip().lower()
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            boundary = ox.geocode_to_gdf(place_name)

            rivers = self._safe_features(place_name, {"waterway": ["river", "stream"]})
            drainage = self._safe_features(place_name, {"waterway": ["drain", "ditch", "canal"]})
            buildings = gpd.GeoDataFrame(geometry=[])  # Skip downloading entire district buildings live
            roads = self._safe_features(place_name, {"highway": ["primary", "trunk"]})
            hospitals = self._safe_features(place_name, {"amenity": "hospital"})
            shelters = self._safe_features(
                place_name, {"amenity": ["shelter", "community_centre", "school"]}
            )

            result = {
                "boundary": boundary,
                "rivers": rivers,
                "drainage": drainage,
                "buildings": buildings,
                "roads": roads,
                "hospitals": hospitals,
                "shelters": shelters,
            }
            self._cache[cache_key] = result
            return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("OSM fetch failed for %s: %s", place_name, exc)
            # Create synthetic fallback boundary for Nilgiris or general place so pipeline never crashes
            from shapely.geometry import box
            if "nilgiri" in cache_key:
                fb = gpd.GeoDataFrame(geometry=[box(76.55, 11.28, 76.90, 11.55)], crs="EPSG:4326")
            else:
                fb = gpd.GeoDataFrame(geometry=[box(80.15, 12.95, 80.30, 13.15)], crs="EPSG:4326")
            fallback_res = {
                "boundary": fb,
                "rivers": gpd.GeoDataFrame(geometry=[]),
                "drainage": gpd.GeoDataFrame(geometry=[]),
                "buildings": gpd.GeoDataFrame(geometry=[]),
                "roads": gpd.GeoDataFrame(geometry=[]),
                "hospitals": gpd.GeoDataFrame(geometry=[]),
                "shelters": gpd.GeoDataFrame(geometry=[]),
            }
            self._cache[cache_key] = fallback_res
            return fallback_res

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
            return [1000.0] * len(centroids)
        try:
            union = features.geometry.unary_union
            return [pt.distance(union) * 111_000 for pt in centroids]
        except Exception:
            return [1000.0] * len(centroids)

    @staticmethod
    def _density_per_cell(grid: gpd.GeoDataFrame, features: gpd.GeoDataFrame | None, is_lines: bool = True):
        if features is None or len(features) == 0:
            return [0.0] * len(grid)

        try:
            # Memory protection: cap features at 2k to avoid OOM on free tier
            feat = features.reset_index(drop=True)
            if len(feat) > 2_000:
                feat = feat.sample(n=2_000, random_state=42)

            joined = gpd.sjoin(
                feat, grid[["grid_id", "geometry"]], how="inner", predicate="intersects"
            )
            counts = joined.groupby("grid_id").size()
            return grid["grid_id"].map(counts).fillna(0.0).tolist()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Density calculation fallback: %s", exc)
            return [0.0] * len(grid)
