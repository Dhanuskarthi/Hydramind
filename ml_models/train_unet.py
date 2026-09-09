"""
Train U-Net Flood Inundation Segmentor
=======================================
Trains a lightweight U-Net to perform binary semantic segmentation:
pixel = 1 (flooded) vs 0 (dry) on satellite imagery.

Input data
----------
  - Sentinel-1 SAR imagery (VV/VH bands, GRD, 10m resolution)
  - Optional: DEM band appended as an extra channel
  - Ground-truth flood masks from:
      * Copernicus Emergency Management Service (EMS)
      * Dartmouth Flood Observatory
      * NRSC (India) damage reports

Usage
-----
    python ml_models/train_unet.py \
        --images data/sentinel1_patches/ \
        --masks  data/flood_masks/ \
        --out    ml_models/unet.pt \
        --epochs 30

Image patches should be 512×512 float32 GeoTIFF files.
Masks should be single-band binary (0/1) GeoTIFF at the same extent.

Architecture
------------
The model is a standard encoder-decoder U-Net:

  Input (C × H × W)
      ↓
  Encoder  [64 → 128 → 256 → 512]  (Conv + BN + ReLU, MaxPool)
      ↓
  Bottleneck [1024]
      ↑
  Decoder  [512 → 256 → 128 → 64]  (ConvTranspose + skip connections)
      ↑
  Output (1 × H × W)  → sigmoid → flood mask
"""
import argparse
import logging
from pathlib import Path

import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Model ─────────────────────────────────────────────────────────────────────

def double_conv(in_ch, out_ch):
    import torch.nn as nn  # noqa: PLC0415
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, 3, padding=1),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
    )


def build_unet(in_channels: int = 3):
    """Returns a minimal U-Net suitable for binary flood segmentation."""
    import torch  # noqa: PLC0415
    import torch.nn as nn  # noqa: PLC0415
    import torch.nn.functional as F  # noqa: PLC0415, N812

    class UNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.enc1 = double_conv(in_channels, 64)
            self.enc2 = double_conv(64, 128)
            self.enc3 = double_conv(128, 256)
            self.enc4 = double_conv(256, 512)
            self.pool = nn.MaxPool2d(2)

            self.bottleneck = double_conv(512, 1024)

            self.up4   = nn.ConvTranspose2d(1024, 512, 2, stride=2)
            self.dec4  = double_conv(1024, 512)
            self.up3   = nn.ConvTranspose2d(512, 256, 2, stride=2)
            self.dec3  = double_conv(512, 256)
            self.up2   = nn.ConvTranspose2d(256, 128, 2, stride=2)
            self.dec2  = double_conv(256, 128)
            self.up1   = nn.ConvTranspose2d(128, 64, 2, stride=2)
            self.dec1  = double_conv(128, 64)

            self.out   = nn.Conv2d(64, 1, 1)  # 1×1 conv → logit

        def forward(self, x):
            e1 = self.enc1(x)
            e2 = self.enc2(self.pool(e1))
            e3 = self.enc3(self.pool(e2))
            e4 = self.enc4(self.pool(e3))
            b  = self.bottleneck(self.pool(e4))
            d4 = self.dec4(torch.cat([self.up4(b),  e4], dim=1))
            d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
            d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
            d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
            return self.out(d1)   # raw logits; apply sigmoid at inference

    return UNet()


# ── Dataset ───────────────────────────────────────────────────────────────────

def load_patches(image_dir: Path, mask_dir: Path):
    import rasterio  # noqa: PLC0415
    import torch  # noqa: PLC0415
    from torch.utils.data import Dataset  # noqa: PLC0415

    class FloodDataset(Dataset):
        def __init__(self):
            self.image_paths = sorted(image_dir.glob("*.tif"))
            self.mask_paths  = sorted(mask_dir.glob("*.tif"))
            assert len(self.image_paths) == len(self.mask_paths), \
                "Number of images and masks must match"

        def __len__(self):
            return len(self.image_paths)

        def __getitem__(self, idx):
            with rasterio.open(self.image_paths[idx]) as src:
                img = src.read().astype(np.float32)  # (C, H, W)
            with rasterio.open(self.mask_paths[idx]) as src:
                msk = src.read(1).astype(np.float32)  # (H, W)
            return torch.tensor(img), torch.tensor(msk).unsqueeze(0)

    return FloodDataset()


# ── Training loop ─────────────────────────────────────────────────────────────

def train(image_dir: str, mask_dir: str, out_path: str, in_channels: int, epochs: int, lr: float):
    import torch  # noqa: PLC0415
    from torch.utils.data import DataLoader, random_split  # noqa: PLC0415

    dataset = load_patches(Path(image_dir), Path(mask_dir))
    val_size = max(1, int(len(dataset) * 0.2))
    train_ds, val_ds = random_split(dataset, [len(dataset) - val_size, val_size])

    model    = build_unet(in_channels=in_channels)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = torch.nn.BCEWithLogitsLoss()

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for images, masks in DataLoader(train_ds, batch_size=4, shuffle=True):
            optimizer.zero_grad()
            logits = model(images)
            loss   = criterion(logits, masks)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if epoch % 5 == 0:
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for images, masks in DataLoader(val_ds, batch_size=4):
                    val_loss += criterion(model(images), masks).item()
            logger.info("Epoch %3d | train=%.4f | val=%.4f", epoch, total_loss, val_loss)

    torch.save(model, out_path)
    logger.info("U-Net saved → %s", out_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images",      required=True, help="Directory of image patches (.tif)")
    parser.add_argument("--masks",       required=True, help="Directory of mask patches (.tif)")
    parser.add_argument("--out",         default="ml_models/unet.pt")
    parser.add_argument("--in-channels", type=int, default=3, help="Number of input channels (e.g. 3 = RGB, 4 = RGB+DEM)")
    parser.add_argument("--epochs",      type=int, default=30)
    parser.add_argument("--lr",          type=float, default=1e-4)
    args = parser.parse_args()
    train(args.images, args.masks, args.out, args.in_channels, args.epochs, args.lr)
