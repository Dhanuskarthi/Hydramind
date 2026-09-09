"""
Train LSTM Rainfall Forecaster
===============================
Trains a PyTorch LSTM to predict the next-hour rainfall intensity
from a sliding window of past hourly observations.

Usage
-----
    python ml_models/train_lstm.py \
        --data data/hourly_rainfall.csv \
        --out  ml_models/lstm.pt \
        --seq-len 24 \
        --epochs 50

Input CSV format
----------------
    timestamp,rainfall_mm
    2023-06-01 00:00:00,2.1
    2023-06-01 01:00:00,5.3
    ...

The trained model is saved as ml_models/lstm.pt and loaded at
inference time by backend/app/ai/lstm_forecaster.py.
"""
import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Model definition ─────────────────────────────────────────────────────────

def build_model(input_size: int = 1, hidden_size: int = 64, num_layers: int = 2):
    import torch.nn as nn  # noqa: PLC0415

    class RainfallLSTM(nn.Module):
        def __init__(self):
            super().__init__()
            self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
            self.fc   = nn.Linear(hidden_size, 1)

        def forward(self, x):
            out, _ = self.lstm(x)          # (batch, seq, hidden)
            return self.fc(out[:, -1, :])  # predict from last timestep

    return RainfallLSTM()


# ── Dataset helper ────────────────────────────────────────────────────────────

def make_sequences(series: np.ndarray, seq_len: int):
    X, y = [], []
    for i in range(len(series) - seq_len):
        X.append(series[i : i + seq_len])
        y.append(series[i + seq_len])
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


# ── Training loop ─────────────────────────────────────────────────────────────

def train(data_path: str, out_path: str, seq_len: int, epochs: int, lr: float):
    import torch  # noqa: PLC0415
    from torch.utils.data import DataLoader, TensorDataset  # noqa: PLC0415

    df = pd.read_csv(data_path, parse_dates=["timestamp"]).sort_values("timestamp")
    rainfall = df["rainfall_mm"].fillna(0).values

    # Normalise to [0, 1]
    r_max = rainfall.max() or 1.0
    series = rainfall / r_max

    X, y = make_sequences(series, seq_len)
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    # (batch, seq, features)
    ds_train = TensorDataset(
        torch.tensor(X_train).unsqueeze(-1),
        torch.tensor(y_train).unsqueeze(-1),
    )
    ds_val = TensorDataset(
        torch.tensor(X_val).unsqueeze(-1),
        torch.tensor(y_val).unsqueeze(-1),
    )

    model = build_model()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = torch.nn.MSELoss()

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in DataLoader(ds_train, batch_size=32, shuffle=True):
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if epoch % 10 == 0:
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for xb, yb in DataLoader(ds_val, batch_size=64):
                    val_loss += criterion(model(xb), yb).item()
            logger.info("Epoch %3d | train_loss=%.5f | val_loss=%.5f", epoch, total_loss, val_loss)

    torch.save(model, out_path)
    logger.info("Model saved → %s  (r_max=%.2f, use this to denormalise output)", out_path, r_max)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",    required=True, help="Path to hourly_rainfall.csv")
    parser.add_argument("--out",     default="ml_models/lstm.pt")
    parser.add_argument("--seq-len", type=int, default=24)
    parser.add_argument("--epochs",  type=int, default=50)
    parser.add_argument("--lr",      type=float, default=1e-3)
    args = parser.parse_args()
    train(args.data, args.out, args.seq_len, args.epochs, args.lr)
