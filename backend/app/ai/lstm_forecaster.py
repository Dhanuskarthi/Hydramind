"""
LSTM Flood Risk Forecaster
===========================
Loads the pre-trained Keras LSTM model (ml_models/flood_risk_lstm.keras)
and the StandardScaler (ml_models/feature_scaler.joblib) to predict
flood risk probability from a 7-day sliding window of 4 features.

Trained features (per day):
  - Rainfall_mm_24hr
  - Cumulative_3day_mm
  - Cumulative_7day_mm
  - Soil_Moisture_avg

Role in the pipeline
--------------------
  Open-Meteo (past 7 days hourly data)
        ↓
  Build daily feature table (rainfall, cumulative, soil moisture)
        ↓
  StandardScaler.transform()
        ↓
  LSTMForecaster.predict(features_7d)
        ↓
  flood_risk_probability (0–1)   <── ensembled with XGBoost output

If the model file is absent the forecaster falls back to a simple
heuristic so the rest of the pipeline keeps working during development.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Sequence

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[4] / "ml_models" / "flood_risk_lstm.keras"
SCALER_PATH = Path(__file__).resolve().parents[4] / "ml_models" / "feature_scaler.joblib"

# Must match training configuration in ml_models/train_flood_lstm.py
SEQUENCE_LENGTH = 7   # 7-day window
NUM_FEATURES = 4      # Rainfall_mm_24hr, Cumulative_3day_mm, Cumulative_7day_mm, Soil_Moisture_avg
FEATURE_NAMES = [
    "Rainfall_mm_24hr",
    "Cumulative_3day_mm",
    "Cumulative_7day_mm",
    "Soil_Moisture_avg",
]


class LSTMForecaster:
    """Wraps the Keras LSTM model for flood risk inference."""

    def __init__(
        self,
        model_path: str | Path = MODEL_PATH,
        scaler_path: str | Path = SCALER_PATH,
    ):
        self.model_path = Path(model_path)
        self.scaler_path = Path(scaler_path)
        self._model = None
        self._scaler = None
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, daily_features: list[dict] | np.ndarray) -> float:
        """
        Predict flood risk probability from a 7-day feature window.

        Parameters
        ----------
        daily_features : list[dict] or np.ndarray
            7 days of feature values. Each dict must contain keys
            matching FEATURE_NAMES, or an ndarray of shape (7, 4).

            Example:
            [
                {"Rainfall_mm_24hr": 12, "Cumulative_3day_mm": 30,
                 "Cumulative_7day_mm": 80, "Soil_Moisture_avg": 42},
                ...  # 6 more days
            ]

        Returns
        -------
        float
            Flood risk probability in [0, 1]. ≥ 0.5 = flood risk.
        """
        if isinstance(daily_features, list):
            arr = np.array(
                [[d.get(f, 0.0) for f in FEATURE_NAMES] for d in daily_features],
                dtype=np.float32,
            )
        else:
            arr = np.array(daily_features, dtype=np.float32)

        # Pad or truncate to SEQUENCE_LENGTH
        if len(arr) < SEQUENCE_LENGTH:
            pad = np.zeros((SEQUENCE_LENGTH - len(arr), NUM_FEATURES), dtype=np.float32)
            arr = np.concatenate([pad, arr], axis=0)
        arr = arr[-SEQUENCE_LENGTH:]  # take last 7 days

        if self._model is not None:
            return self._infer_keras(arr)
        return self._fallback_heuristic(arr)

    def predict_simple(self, rainfall_sequence: Sequence[float], soil_moisture: float = 50.0) -> float:
        """
        Convenience method: build features from a simple rainfall series.
        Used when full daily feature data is not yet available.

        Parameters
        ----------
        rainfall_sequence : list[float]
            Daily rainfall values (mm) for the past 7 days.
        soil_moisture : float
            Average soil moisture percentage.

        Returns
        -------
        float
            Flood risk probability in [0, 1].
        """
        seq = list(rainfall_sequence)
        # Pad to 7 days
        while len(seq) < SEQUENCE_LENGTH:
            seq.insert(0, 0.0)
        seq = seq[-SEQUENCE_LENGTH:]

        daily_features = []
        for i, rain_24hr in enumerate(seq):
            cum_3d = sum(seq[max(0, i - 2):i + 1])
            cum_7d = sum(seq[:i + 1])
            daily_features.append({
                "Rainfall_mm_24hr": rain_24hr,
                "Cumulative_3day_mm": cum_3d,
                "Cumulative_7day_mm": cum_7d,
                "Soil_Moisture_avg": soil_moisture,
            })
        return self.predict(daily_features)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _load(self):
        """Attempt to load the Keras model and scaler."""
        if not self.model_path.exists():
            logger.info(
                "LSTM model not found at %s – using heuristic fallback. "
                "Train with ml_models/train_flood_lstm.py.",
                self.model_path,
            )
            return

        # Load scaler first
        if self.scaler_path.exists():
            try:
                import joblib  # noqa: PLC0415
                self._scaler = joblib.load(str(self.scaler_path))
                logger.info("Feature scaler loaded from %s", self.scaler_path)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not load scaler: %s", exc)

        # Load Keras model
        try:
            import tensorflow as tf  # noqa: PLC0415
            tf.get_logger().setLevel("ERROR")  # suppress TF info spam
            self._model = tf.keras.models.load_model(str(self.model_path))
            logger.info("LSTM Keras model loaded from %s", self.model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load LSTM Keras model: %s", exc)

    def _infer_keras(self, arr: np.ndarray) -> float:
        """Run inference through the real Keras model."""
        # Scale features the same way training did
        if self._scaler is not None:
            arr_flat = arr.reshape(-1, NUM_FEATURES)
            arr_scaled = self._scaler.transform(arr_flat).reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)
        else:
            arr_scaled = arr.reshape(1, SEQUENCE_LENGTH, NUM_FEATURES)

        prediction = self._model.predict(arr_scaled, verbose=0)
        prob = float(prediction.ravel()[0])
        return max(0.0, min(1.0, prob))

    @staticmethod
    def _fallback_heuristic(arr: np.ndarray) -> float:
        """
        Rule-based fallback that mirrors the training label logic:
          flood_risk = (rainfall_24hr >= 64.5) OR
                       (cumulative_3day >= 100 AND soil_moisture >= 45)
        """
        logger.debug("LSTM model absent – using heuristic fallback")
        last_day = arr[-1]
        rainfall_24hr = last_day[0]
        cum_3day = last_day[1]
        soil_moisture = last_day[3]

        if rainfall_24hr >= 64.5:
            return min(0.6 + (rainfall_24hr - 64.5) / 100.0, 1.0)
        if cum_3day >= 100 and soil_moisture >= 45:
            return min(0.5 + (cum_3day - 100) / 200.0, 1.0)

        # Graduated risk
        risk = (
            min(rainfall_24hr / 64.5, 1.0) * 0.4
            + min(cum_3day / 100.0, 1.0) * 0.35
            + min(soil_moisture / 100.0, 1.0) * 0.25
        )
        return max(0.0, min(risk, 1.0))
