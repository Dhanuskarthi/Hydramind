"""
Combines every layer (OSM, terrain, rainfall, soil) into one
flood-risk score per grid cell.

This is a transparent, weighted rule-based model on purpose - it is
easy to explain to judges/officials and easy to later swap for a
trained XGBoost model (see ml_models/train_susceptibility.py) without
changing the API contract: both return `risk_score` (0-1) and
`risk_level` per grid cell.
"""
import numpy as np
import geopandas as gpd

from app.config import settings


class RiskEngine:
    def __init__(self):
        self.weights = settings.RISK_WEIGHTS
        self.thresholds = settings.RISK_THRESHOLDS

    def calculate_risk(
        self,
        grid: gpd.GeoDataFrame,
        rainfall: dict,
        soil: dict,
    ) -> gpd.GeoDataFrame:
        grid = grid.copy()
        n = len(grid)

        features = {}

        # --- Hydrology: closer to a river/drain = higher risk ---
        if "dist_to_river_m" in grid and grid["dist_to_river_m"].notna().any():
            max_d = grid["dist_to_river_m"].max() or 1
            features["dist_to_river"] = 1 - (grid["dist_to_river_m"].fillna(max_d) / max_d)
        else:
            features["dist_to_river"] = np.full(n, 0.5)  # unknown -> neutral

        # --- Terrain: lower elevation = higher risk ---
        if "elevation_m" in grid and grid["elevation_m"].notna().any():
            e = grid["elevation_m"].astype(float)
            features["elevation"] = 1 - self._normalize(e)
        else:
            features["elevation"] = np.full(n, 0.5)

        # --- Drainage density: poor/absent drainage raises risk (inverse of density here
        #     since sparse formal drainage near dense settlement = worse runoff handling) ---
        if "drainage_density" in grid:
            features["drainage_density"] = 1 - self._normalize(grid["drainage_density"].fillna(0))
        else:
            features["drainage_density"] = np.full(n, 0.5)

        # --- Building density: more exposure = more people/assets at risk ---
        if "building_density" in grid:
            features["building_density"] = self._normalize(grid["building_density"].fillna(0))
        else:
            features["building_density"] = np.full(n, 0.5)

        # --- Impervious proxy: road density as a stand-in for paved/impervious surface ---
        if "road_density" in grid:
            features["impervious_pct"] = self._normalize(grid["road_density"].fillna(0))
        else:
            features["impervious_pct"] = np.full(n, 0.5)

        # --- Real-time rainfall (same value applied district-wide for MVP) ---
        rainfall_mm = rainfall.get("current_rainfall_mm", 0) or 0
        features["current_rainfall"] = np.full(n, min(rainfall_mm / 50.0, 1.0))  # 50mm/hr ~ saturation

        # --- Soil moisture (same value applied district-wide for MVP) ---
        soil_moisture = rainfall.get("soil_moisture_pct", 50) or 50
        features["soil_moisture"] = np.full(n, min(soil_moisture / 100.0, 1.0))

        # --- Weighted sum ---
        score = np.zeros(n)
        total_weight = 0
        for key, weight in self.weights.items():
            if key in features:
                score += np.nan_to_num(features[key]) * weight
                total_weight += weight
        if total_weight > 0:
            score = score / total_weight

        score = np.clip(score, 0, 1)

        grid["risk_score"] = score
        grid["risk_level"] = [self._categorize(s) for s in score]
        return grid

    def _categorize(self, score: float) -> str:
        level = "MINIMAL"
        for name, threshold in sorted(self.thresholds.items(), key=lambda kv: kv[1]):
            if score >= threshold:
                level = name
        return level

    @staticmethod
    def _normalize(series):
        s = np.asarray(series, dtype="float64")
        rng = s.max() - s.min()
        if rng == 0:
            return np.zeros_like(s)
        return (s - s.min()) / rng
