"""
Generate a synthetic XGBoost training dataset from the existing
Nilgiris landslide/flood dataset + realistic feature distributions.

This creates a labeled CSV that train_susceptibility.py can consume
directly, bridging the gap until real PostGIS-stored grid data is available.

Usage:
    python ml_models/generate_xgb_training_data.py
    python ml_models/train_susceptibility.py --data ml_models/xgb_training_data.csv --out ml_models/flood_susceptibility.json
"""
import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42
np.random.seed(SEED)

OUT_PATH = Path(__file__).parent / "xgb_training_data.csv"
EXCEL_PATH = Path(__file__).parent / "nilgiris_landslide_dataset.xlsx"

N_SAMPLES = 2000  # synthetic grid cells

def main():
    # ── 1. Load real rainfall/soil data for realistic distributions ────
    real_rain = None
    real_soil = None
    if EXCEL_PATH.exists():
        try:
            xls = pd.ExcelFile(EXCEL_PATH)
            rain_df = pd.read_excel(xls, sheet_name="Rainfall_Data")
            soil_df = pd.read_excel(xls, sheet_name="Soil_Moisture_Sensors")
            real_rain = rain_df["Rainfall_mm_24hr"].dropna().values
            real_soil = soil_df["Soil_Moisture_pct"].dropna().values
            print(f"Loaded real data: {len(real_rain)} rainfall obs, {len(real_soil)} soil obs")
        except Exception as e:
            print(f"Could not load Excel data: {e}")

    # ── 2. Generate features with realistic distributions ─────────────
    # Distance to river (m): 50–5000m, log-normal
    dist_to_river = np.random.lognormal(mean=6.5, sigma=0.8, size=N_SAMPLES).clip(50, 5000)

    # Distance to drain (m): 20–3000m
    dist_to_drain = np.random.lognormal(mean=5.8, sigma=0.9, size=N_SAMPLES).clip(20, 3000)

    # Drainage density: 0–15 per cell
    drainage_density = np.random.exponential(scale=3.0, size=N_SAMPLES).clip(0, 15)

    # Building density: 0–50 per cell
    building_density = np.random.exponential(scale=8.0, size=N_SAMPLES).clip(0, 50)

    # Road density: 0–20 per cell
    road_density = np.random.exponential(scale=4.0, size=N_SAMPLES).clip(0, 20)

    # Elevation (m): 2–600m, mix of low-lying and elevated
    elevation = np.concatenate([
        np.random.normal(loc=15, scale=10, size=N_SAMPLES // 2).clip(2, 50),   # coastal/low
        np.random.normal(loc=200, scale=150, size=N_SAMPLES // 2).clip(50, 600) # elevated
    ])
    np.random.shuffle(elevation)

    # Slope (degrees): 0–45
    slope = np.random.exponential(scale=5.0, size=N_SAMPLES).clip(0, 45)

    # Rainfall (mm): use real distribution if available
    if real_rain is not None and len(real_rain) > 0:
        rainfall = np.random.choice(real_rain, size=N_SAMPLES, replace=True)
        # Add some noise
        rainfall = (rainfall + np.random.normal(0, 5, N_SAMPLES)).clip(0, 200)
    else:
        rainfall = np.random.exponential(scale=15, size=N_SAMPLES).clip(0, 200)

    # Soil moisture (%): use real distribution if available
    if real_soil is not None and len(real_soil) > 0:
        soil_moisture = np.random.choice(real_soil, size=N_SAMPLES, replace=True)
        soil_moisture = (soil_moisture + np.random.normal(0, 3, N_SAMPLES)).clip(5, 95)
    else:
        soil_moisture = np.random.normal(loc=45, scale=15, size=N_SAMPLES).clip(5, 95)

    # Soil clay %: 10–60%
    soil_clay = np.random.normal(loc=30, scale=12, size=N_SAMPLES).clip(10, 60)

    # Soil sand %: 15–75%
    soil_sand = np.random.normal(loc=40, scale=15, size=N_SAMPLES).clip(15, 75)

    # Soil permeability: 0.05–1.0
    soil_permeability = ((soil_sand - soil_clay) / 100 + 0.5).clip(0.05, 1.0)

    # ── 3. Generate flood labels using physically-grounded rules ──────
    #    Mirrors the same logic used in the LSTM training and risk engine:
    #    - Heavy rainfall (≥64.5mm) + low elevation + near river = HIGH RISK
    #    - Saturated soil (≥45%) + cumulative rain + poor drainage = HIGH RISK
    risk_score = (
        np.clip(rainfall / 65.0, 0, 1) * 0.30
        + np.clip(1 - elevation / 500.0, 0, 1) * 0.15
        + np.clip(soil_moisture / 100.0, 0, 1) * 0.20
        + np.clip(1 - dist_to_river / 3000.0, 0, 1) * 0.20
        + np.clip(1 - soil_permeability, 0, 1) * 0.10
        + np.clip(1 - slope / 30.0, 0, 1) * 0.05
    )
    # Add noise and threshold
    risk_score += np.random.normal(0, 0.08, N_SAMPLES)
    flooded = (risk_score >= 0.55).astype(int)

    # ── 4. Assemble DataFrame ─────────────────────────────────────────
    df = pd.DataFrame({
        "dist_to_river_m": np.round(dist_to_river, 1),
        "dist_to_drain_m": np.round(dist_to_drain, 1),
        "drainage_density": np.round(drainage_density, 2),
        "building_density": np.round(building_density, 2),
        "road_density": np.round(road_density, 2),
        "elevation_m": np.round(elevation, 1),
        "slope_deg": np.round(slope, 2),
        "rainfall_current_rainfall_mm": np.round(rainfall, 1),
        "rainfall_soil_moisture_pct": np.round(soil_moisture, 1),
        "soil_clay_pct": np.round(soil_clay, 1),
        "soil_sand_pct": np.round(soil_sand, 1),
        "soil_permeability": np.round(soil_permeability, 3),
        "flooded": flooded,
    })

    df.to_csv(OUT_PATH, index=False)
    print(f"\nGenerated {N_SAMPLES} training samples -> {OUT_PATH}")
    print(f"Flood label balance:\n{df['flooded'].value_counts()}")
    print(f"\nNow run:")
    print(f"  python train_susceptibility.py --data {OUT_PATH.name} --out flood_susceptibility.json")

if __name__ == "__main__":
    main()
