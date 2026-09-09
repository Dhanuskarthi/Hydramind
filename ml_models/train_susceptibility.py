"""
Trains an XGBoost flood-susceptibility classifier on the feature table
produced by data_processing/build_training_table.py, once you've joined
on a `flooded` (0/1) label column from historical flood records.

This is the upgrade path from RiskEngine's transparent weighted-sum
score (backend/app/services/risk_engine.py) to a learned model. Swap
it in by loading model.json in a new `MLRiskEngine` service that
implements the same `calculate_risk(grid, rainfall, soil)` interface.

Usage:
    python ml_models/train_susceptibility.py --data data/chennai_grid_labeled.csv --out models/flood_susceptibility.json
"""
import argparse
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

FEATURE_COLUMNS = [
    "dist_to_river_m",
    "dist_to_drain_m",
    "drainage_density",
    "building_density",
    "road_density",
    "elevation_m",
    "slope_deg",
    "rainfall_current_rainfall_mm",
    "rainfall_soil_moisture_pct",
    "soil_clay_pct",
    "soil_sand_pct",
    "soil_permeability",
]


def main(data_path: str, out_path: str):
    df = pd.read_csv(data_path)

    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing expected feature columns: {missing}")
    if "flooded" not in df.columns:
        raise SystemExit(
            "No 'flooded' label column found. Join historical flood records "
            "onto grid_id before training (see README -> Historical flood data)."
        )

    X = df[FEATURE_COLUMNS].fillna(df[FEATURE_COLUMNS].median())
    y = df["flooded"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        scale_pos_weight=(y_train == 0).sum() / max((y_train == 1).sum(), 1),
        eval_metric="logloss",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    print(classification_report(y_test, preds))
    print("ROC-AUC:", roc_auc_score(y_test, proba))

    model.save_model(out_path)
    print(f"Saved model -> {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="flood_susceptibility.json")
    args = parser.parse_args()
    main(args.data, args.out)
