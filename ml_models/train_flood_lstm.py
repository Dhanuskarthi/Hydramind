import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

SEED = 42
np.random.seed(SEED)
tf.random.set_seed(SEED)

DATA_PATH = "nilgiris_landslide_dataset.xlsx"
OUT_DIR = "."
WINDOW = 7          # days of history the LSTM sees
TEST_FRAC = 0.2      # last 20% of each station's timeline held out

# ---------------------------------------------------------------------
# 1. Load & merge
# ---------------------------------------------------------------------
xls = pd.ExcelFile(DATA_PATH)
rain = pd.read_excel(xls, sheet_name="Rainfall_Data")
soil = pd.read_excel(xls, sheet_name="Soil_Moisture_Sensors")

rain["Date"] = pd.to_datetime(rain["Date"])
soil["Date"] = pd.to_datetime(soil["Date"])

# average soil moisture across the two sensor depths (30cm & 60cm) per day
soil_avg = (
    soil.groupby(["Location", "Date"])["Soil_Moisture_pct"]
    .mean()
    .reset_index()
    .rename(columns={"Soil_Moisture_pct": "Soil_Moisture_avg"})
)

df = rain.merge(soil_avg, on=["Location", "Date"], how="left")
df = df.sort_values(["Station_ID", "Date"]).reset_index(drop=True)

# ---------------------------------------------------------------------
# 2. Proxy flood-risk label
# ---------------------------------------------------------------------
df["Flood_Risk"] = (
    (df["Rainfall_mm_24hr"] >= 64.5)
    | ((df["Cumulative_3day_mm"] >= 100) & (df["Soil_Moisture_avg"] >= 45))
).astype(int)

FEATURES = [
    "Rainfall_mm_24hr",
    "Cumulative_3day_mm",
    "Cumulative_7day_mm",
    "Soil_Moisture_avg",
]

print("Merged dataset shape:", df.shape)
print("Flood_Risk balance:\n", df["Flood_Risk"].value_counts())
print("Flood_Risk by station:\n", df.groupby("Station_ID")["Flood_Risk"].sum())

# ---------------------------------------------------------------------
# 3. Build per-station sliding-window sequences (time-based split)
# ---------------------------------------------------------------------
X_train, y_train, X_test, y_test = [], [], [], []
train_scalers_data = []  # collect train rows to fit ONE global scaler

station_sequences = {}
for station, g in df.groupby("Station_ID"):
    g = g.sort_values("Date").reset_index(drop=True)
    n = len(g)
    split_idx = int(n * (1 - TEST_FRAC))  # index separating train/test region

    feats = g[FEATURES].values
    labels = g["Flood_Risk"].values

    seqs, labs, is_train_flags = [], [], []
    for i in range(WINDOW, n):
        seqs.append(feats[i - WINDOW:i])
        labs.append(labels[i])
        # a sequence belongs to "train" only if its target day is before split
        is_train_flags.append(i < split_idx)

    station_sequences[station] = (np.array(seqs), np.array(labs), np.array(is_train_flags))

for station, (seqs, labs, is_train_flags) in station_sequences.items():
    X_train.append(seqs[is_train_flags])
    y_train.append(labs[is_train_flags])
    X_test.append(seqs[~is_train_flags])
    y_test.append(labs[~is_train_flags])

X_train = np.concatenate(X_train, axis=0)
y_train = np.concatenate(y_train, axis=0)
X_test = np.concatenate(X_test, axis=0)
y_test = np.concatenate(y_test, axis=0)

print(f"\nTrain sequences: {X_train.shape}, positive rate: {y_train.mean():.3f}")
print(f"Test sequences:  {X_test.shape}, positive rate: {y_test.mean():.3f}")

# Shuffle the training set ONCE (fixed seed) before Keras carves off its
# validation_split. Keras always takes the validation slice from the *tail*
# of the array as-given (pre-shuffle), and our array is built by
# concatenating station-by-station (...RS01, RS02, RS03, RS04). RS04 (Ooty)
# has zero flood-risk days in this synthetic set, so an un-shuffled tail
# slice produced an all-negative validation split (val_auc was undefined).
# Shuffling once up front mixes stations/classes into every split.
rng = np.random.default_rng(SEED)
perm = rng.permutation(len(X_train))
X_train, y_train = X_train[perm], y_train[perm]

# ---------------------------------------------------------------------
# 4. Scale (fit ONLY on train, flatten across time steps)
# ---------------------------------------------------------------------
n_train, w, f = X_train.shape
scaler = StandardScaler()
scaler.fit(X_train.reshape(-1, f))

X_train_scaled = scaler.transform(X_train.reshape(-1, f)).reshape(n_train, w, f)
X_test_scaled = scaler.transform(X_test.reshape(-1, f)).reshape(X_test.shape[0], w, f)

# ---------------------------------------------------------------------
# 5. Build & train the LSTM
# ---------------------------------------------------------------------
class_counts = np.bincount(y_train)
class_weight = {
    0: len(y_train) / (2 * class_counts[0]),
    1: len(y_train) / (2 * class_counts[1]),
}
print("\nClass weights:", class_weight)

model = keras.Sequential([
    layers.Input(shape=(WINDOW, len(FEATURES))),
    layers.LSTM(32, return_sequences=True),
    layers.Dropout(0.2),
    layers.LSTM(16),
    layers.Dropout(0.2),
    layers.Dense(8, activation="relu"),
    layers.Dense(1, activation="sigmoid"),
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss="binary_crossentropy",
    metrics=[keras.metrics.AUC(name="auc"), "accuracy"],
)
model.summary()

early_stop = keras.callbacks.EarlyStopping(
    monitor="val_auc", mode="max", patience=15, restore_best_weights=True
)

history = model.fit(
    X_train_scaled, y_train,
    validation_split=0.2,
    epochs=150,
    batch_size=16,
    class_weight=class_weight,
    callbacks=[early_stop],
    verbose=2,
)

# ---------------------------------------------------------------------
# 6. Evaluate on held-out test set
# ---------------------------------------------------------------------
y_prob = model.predict(X_test_scaled).ravel()
y_pred = (y_prob >= 0.5).astype(int)

metrics = {
    "accuracy": accuracy_score(y_test, y_pred),
    "precision": precision_score(y_test, y_pred, zero_division=0),
    "recall": recall_score(y_test, y_pred, zero_division=0),
    "f1": f1_score(y_test, y_pred, zero_division=0),
}
if len(np.unique(y_test)) > 1:
    metrics["roc_auc"] = roc_auc_score(y_test, y_prob)
else:
    metrics["roc_auc"] = float("nan")

print("\n=== TEST METRICS ===")
for k, v in metrics.items():
    print(f"{k}: {v:.3f}")
print("\nClassification report:\n", classification_report(y_test, y_pred, zero_division=0))

cm = confusion_matrix(y_test, y_pred)
print("Confusion matrix:\n", cm)

# ---------------------------------------------------------------------
# 7. Plots
# ---------------------------------------------------------------------
fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))

axes[0].plot(history.history["loss"], label="train")
axes[0].plot(history.history["val_loss"], label="val")
axes[0].set_title("Loss")
axes[0].set_xlabel("Epoch")
axes[0].legend()

axes[1].plot(history.history["auc"], label="train")
axes[1].plot(history.history["val_auc"], label="val")
axes[1].set_title("ROC-AUC")
axes[1].set_xlabel("Epoch")
axes[1].legend()

im = axes[2].imshow(cm, cmap="Blues")
axes[2].set_title(f"Confusion Matrix (test, n={len(y_test)})")
axes[2].set_xticks([0, 1]); axes[2].set_xticklabels(["No Risk", "Flood Risk"])
axes[2].set_yticks([0, 1]); axes[2].set_yticklabels(["No Risk", "Flood Risk"])
axes[2].set_xlabel("Predicted"); axes[2].set_ylabel("Actual")
for i in range(2):
    for j in range(2):
        axes[2].text(j, i, str(cm[i, j]), ha="center", va="center",
                      color="white" if cm[i, j] > cm.max() / 2 else "black")

plt.tight_layout()
plt.savefig(f"{OUT_DIR}/training_results.png", dpi=150)
print(f"\nSaved plot to {OUT_DIR}/training_results.png")

# ---------------------------------------------------------------------
# 8. Save model + scaler
# ---------------------------------------------------------------------
model.save(f"{OUT_DIR}/flood_risk_lstm.keras")
import joblib
joblib.dump(scaler, f"{OUT_DIR}/feature_scaler.joblib")
print(f"Saved model to {OUT_DIR}/flood_risk_lstm.keras")
print(f"Saved scaler to {OUT_DIR}/feature_scaler.joblib")

# save metrics to a small text summary
with open(f"{OUT_DIR}/metrics_summary.txt", "w") as fp:
    fp.write("LSTM Flood-Risk Model — Test Set Metrics\n")
    fp.write("=" * 45 + "\n")
    for k, v in metrics.items():
        fp.write(f"{k}: {v:.3f}\n")
    fp.write(f"\nConfusion matrix (rows=actual, cols=predicted):\n{cm}\n")
    fp.write(f"\nTrain sequences: {X_train.shape[0]}  Test sequences: {X_test.shape[0]}\n")
    fp.write(f"Window length: {WINDOW} days | Features: {FEATURES}\n")
print(f"Saved metrics summary to {OUT_DIR}/metrics_summary.txt")
