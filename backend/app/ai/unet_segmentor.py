"""
U-Net Flood Inundation Segmentor
==================================
Loads a pre-trained PyTorch U-Net (ml_models/unet.pt) and performs
pixel-level semantic segmentation on a satellite image (+ optional DEM
band) to produce a binary flood inundation mask.

Role in the pipeline
--------------------
  Input : satellite image array  (H × W × C, e.g. Sentinel-2 RGB+NIR)
           optional DEM array    (H × W)   ← from DEMService

  Output: flood_mask (np.ndarray, bool, H × W)
           blue pixels  → flooded
           black pixels → dry

  The mask is then converted to GeoJSON polygons and overlaid on the
  GIS risk map inside FloodRiskFusion (gis/flood_risk_fusion.py).

If the model file is absent the segmentor returns a null mask (all
False) so the rest of the pipeline keeps working during development.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[4] / "ml_models" / "unet.pt"

# Expected input spatial size (pixels). Images are resized to this before inference.
INPUT_SIZE = (512, 512)


class UNetSegmentor:
    """Wraps the PyTorch U-Net for flood inundation inference."""

    def __init__(self, model_path: str | Path = MODEL_PATH):
        self.model_path = Path(model_path)
        self._model = None
        self._torch = None
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def segment(
        self,
        image: np.ndarray,
        dem: np.ndarray | None = None,
        threshold: float = 0.5,
    ) -> np.ndarray:
        """
        Produce a binary flood mask.

        Parameters
        ----------
        image : np.ndarray  shape (H, W, C)  float32, values in [0, 1]
        dem   : np.ndarray  shape (H, W)      optional elevation band
        threshold : float   decision boundary (default 0.5)

        Returns
        -------
        np.ndarray  shape (H, W)  bool
            True = flooded pixel.
        """
        if image.ndim != 3:
            raise ValueError("image must be (H, W, C)")

        if dem is not None:
            dem_band = dem[:, :, np.newaxis].astype(np.float32)
            # Normalise DEM to [0, 1]
            d_min, d_max = dem_band.min(), dem_band.max()
            if d_max > d_min:
                dem_band = (dem_band - d_min) / (d_max - d_min)
            image = np.concatenate([image, dem_band], axis=-1)

        if self._model is not None:
            return self._infer_torch(image, threshold)

        logger.debug("U-Net model absent – returning null mask")
        return np.zeros(image.shape[:2], dtype=bool)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _load(self):
        if not self.model_path.exists():
            logger.info(
                "U-Net model not found at %s – flood segmentation disabled. "
                "Train the model with ml_models/train_unet.py.",
                self.model_path,
            )
            return
        try:
            import torch  # noqa: PLC0415

            self._torch = torch
            self._model = torch.load(self.model_path, map_location="cpu")
            self._model.eval()
            logger.info("U-Net model loaded from %s", self.model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load U-Net model: %s", exc)

    def _infer_torch(self, image: np.ndarray, threshold: float) -> np.ndarray:
        torch = self._torch
        from torchvision.transforms.functional import resize  # noqa: PLC0415
        import torch.nn.functional as F  # noqa: PLC0415, N812

        h_orig, w_orig = image.shape[:2]
        # (H, W, C) -> (1, C, H, W)
        x = torch.tensor(image.transpose(2, 0, 1), dtype=torch.float32).unsqueeze(0)
        x = F.interpolate(x, size=INPUT_SIZE, mode="bilinear", align_corners=False)

        with torch.no_grad():
            logits = self._model(x)          # (1, 1, H', W')
            proba = torch.sigmoid(logits).squeeze().numpy()

        # Resize back to original resolution
        proba_full = np.array(
            torch.nn.functional.interpolate(
                torch.tensor(proba).unsqueeze(0).unsqueeze(0),
                size=(h_orig, w_orig),
                mode="bilinear",
                align_corners=False,
            ).squeeze()
        )
        return proba_full >= threshold
