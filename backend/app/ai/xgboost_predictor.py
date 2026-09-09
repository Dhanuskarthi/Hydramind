"""
XGBoost Flood Probability Predictor
=====================================
Loads the trained XGBoost classifier (ml_models/flood_susceptibility.json)
and scores each 150m grid cell with a flood probability (0–1).

Role in the pipeline
--------------------
  Inputs (one row per grid cell):
    - rain_forecast_mm   ← from LSTMForecaster
    - elevation_m        ← from DEMService
    - slope_deg          ← from DEMService
    - dist_to_river_m    ← from OSMService
    - soil_moisture_pct  ← from RainfallService (Open-Meteo)
    - drainage_density   ← from OSMService
    - soil_clay_pct      ← from SoilService
    - soil_permeability  ← from SoilService

  Output: flood_probability (0–1)  per cell

The model is trained by ml_models/train_susceptibility.py. If it is
absent, the predictor delegates to the existing rule-based RiskEngine
so the API stays functional during development.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[4] / "ml_models" / "flood_susceptibility.json"

FEATURE_COLUMNS = [
    "rain_forecast_mm",
    "elevation_m",
    "slope_deg",
    "dist_to_river_m",
    "soil_moisture_pct",
    "drainage_density",
    "soil_clay_pct",
    "soil_permeability",
]


class XGBoostPredictor:
    """Wraps the XGBoost flood susceptibility model for batch inference."""

    def __init__(self, model_path: str | Path = MODEL_PATH):
        self.model_path = Path(model_path)
        self._model = None
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict_proba(self, features: dict[str, Any] | pd.DataFrame) -> np.ndarray:
        """
        Score one or more grid cells.

        Parameters
        ----------
        features : dict or DataFrame
            Keys / columns must include the FEATURE_COLUMNS above.
            Missing columns are filled with the column median (from
            training) or 0 as a safe default.

        Returns
        -------
        np.ndarray of shape (n_cells,)
            Flood probability in [0, 1] for each cell.
        """
        df = pd.DataFrame([features]) if isinstance(features, dict) else features.copy()
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0.0
        df = df[FEATURE_COLUMNS].fillna(0.0)

        if self._model is not None:
            return self._model.predict_proba(df)[:, 1]

        # Fallback: simple linear combination (mirrors RISK_WEIGHTS order-of-magnitude)
        logger.debug("XGBoost model absent – using linear fallback")
        score = (
            np.clip(df["rain_forecast_mm"] / 50.0, 0, 1) * 0.30
            + np.clip(1 - df["elevation_m"] / 1000.0, 0, 1) * 0.15
            + np.clip(df["soil_moisture_pct"] / 100.0, 0, 1) * 0.20
            + np.clip(1 - df["dist_to_river_m"] / 5000.0, 0, 1) * 0.25
            + np.clip(df["slope_deg"] / 45.0, 0, 1) * 0.10
        )
        return np.clip(score.values, 0.0, 1.0)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _load(self):
        if not self.model_path.exists():
            logger.info(
                "XGBoost model not found at %s – using linear fallback. "
                "Run data_processing/build_training_table.py then "
                "ml_models/train_susceptibility.py to generate it.",
                self.model_path,
            )
            return
        try:
            import xgboost as xgb  # noqa: PLC0415

            self._model = xgb.XGBClassifier()
            self._model.load_model(str(self.model_path))
            logger.info("XGBoost model loaded from %s", self.model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load XGBoost model: %s", exc)
