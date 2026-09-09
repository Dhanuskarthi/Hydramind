# HydraMind — Real-Time, Village-Level Flood Risk Mapping

A flood-risk mapping system that fuses free, open geospatial and weather
data with a **three-model AI pipeline** into a **150m-grid risk map**, updated
on a live rainfall cadence, with village-level alerting, rescue prioritisation,
and evacuation routing on top.

---

## Architecture

```
                  ┌──────────────────────────────────────────────────────┐
                  │             DATA INGESTION LAYER                     │
                  │                                                      │
  IMD / Open-Meteo ──► RainfallService   ──► current rain, soil moisture│
  NASA GPM / RainViewer──►                   ──► radar metadata         │
  OpenTopography SRTM ──► DEMService     ──► elevation, slope           │
  OpenStreetMap / osmnx──► OSMService    ──► rivers, roads, hospitals   │
  SoilGrids          ──► SoilService     ──► clay%, permeability        │
                  └──────────────────────────────────────────────────────┘
                                      │
                            (150m × 150m grid)
                                      │
                  ┌──────────────────────────────────────────────────────┐
                  │               AI PIPELINE (late fusion)              │
                  │                                                      │
                  │  1. LSTMForecaster                                   │
                  │     [past 24hr rainfall sequence]                    │
                  │              ↓                                       │
                  │     rain_forecast_mm  ──────────────────────────┐   │
                  │                                                  │   │
                  │  2. XGBoostPredictor                             │   │
                  │     [rain_forecast + elevation + slope +         │   │
                  │      dist_to_river + soil + drainage_density] ◄──┘   │
                  │              ↓                                       │
                  │     flood_probability  (0–1 per grid cell)           │
                  │                                                      │
                  │  3. UNetSegmentor   (optional, needs satellite image)│
                  │     [Sentinel-1 SAR patch + DEM band]                │
                  │              ↓                                       │
                  │     flood_mask  (bool H×W → GeoJSON polygons)        │
                  └──────────────────────────────────────────────────────┘
                                      │
                  ┌──────────────────────────────────────────────────────┐
                  │          GIS PROCESSING ENGINE                       │
                  │  FloodRiskFusion (gis/flood_risk_fusion.py)          │
                  │                                                      │
                  │  • mask_to_polygons   – U-Net mask → Shapely polys   │
                  │  • find_affected_areas – ST_Intersects villages/     │
                  │                          hospitals in PostGIS        │
                  │  • compute_rescue_priorities – pop × risk ranking    │
                  └──────────────────────────────────────────────────────┘
                                      │
                  ┌──────────────────────────────────────────────────────┐
                  │            DECISION ENGINE                           │
                  │  (services/decision_engine.py)                       │
                  │                                                      │
                  │  • flood_severity_score  (P95 district aggregate)    │
                  │  • infrastructure_risk   (hospital / bridge status)  │
                  │  • generate_alerts       (auto-push via Celery)      │
                  │  • evacuation_routes     (nearest safe shelter)      │
                  └──────────────────────────────────────────────────────┘
                                      │
                          FastAPI REST API  (GeoJSON)
                                      │
              ┌───────────────────────┴────────────────────────┐
              ▼                                                 ▼
      React Dashboard                                   Flutter Mobile App
      (authorities — live map,                          (citizens — alerts,
       rescue priority table)                            evacuation route)
```

### Why three separate models?

| Model | Input | Output | Role |
|---|---|---|---|
| LSTM | Past 24–72 hr rainfall sequence | Forecast mm/hr | *When* to expect rain |
| XGBoost | Forecast rain + terrain + hydrology + soil | Flood probability 0–1 | *How likely* is flooding |
| U-Net | Satellite image (Sentinel-1) + DEM | Pixel flood mask | *Where exactly* is flooded |

The models are **not merged** — they run independently and their outputs
are fused by `FloodRiskFusion` (late/decision-level fusion). LSTM output
becomes an input feature for XGBoost. U-Net provides the spatial inundation
map that GIS overlays on villages and hospitals.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend Web | React + Vite | Disaster management dashboard |
| Mobile App | Flutter | Citizen alerts (Android/iOS) — see Extending |
| Backend API | FastAPI (Python) | Native Python AI integration, async |
| AI — Forecasting | PyTorch LSTM | Time-series rainfall prediction |
| AI — Risk scoring | XGBoost | Fast, explainable flood probability |
| AI — Inundation | PyTorch U-Net | Pixel-level flood segmentation |
| GIS Engine | GeoPandas, Rasterio, Shapely | Spatial analysis & overlay |
| Database | PostgreSQL + PostGIS | Geospatial queries (ST_Within etc.) |
| Cache / Broker | Redis | Fast alerts + Celery task queue |
| Task Queue | Celery | Background AI processing |
| Maps | OpenStreetMap + Leaflet | Interactive flood maps |
| Deployment | Docker + Nginx | Containerised production stack |

---

## Project Layout

```
hydramind/
│
├── backend/
│   ├── app/
│   │   ├── main.py               FastAPI app entrypoint
│   │   ├── config.py             Settings (weights, thresholds, API keys)
│   │   │
│   │   ├── api/                  (alias for routers/)
│   │   ├── routers/
│   │   │   ├── risk.py           GET /risk-map, GET /current-conditions
│   │   │   ├── alerts.py         GET /alerts, POST /alerts/send
│   │   │   ├── villages.py       GET /villages
│   │   │   ├── predict.py        POST /predict   ← full AI pipeline
│   │   │   └── evacuation.py     GET /evacuation-route
│   │   │
│   │   ├── ai/                   AI inference engines
│   │   │   ├── lstm_forecaster.py   LSTM rainfall forecasting
│   │   │   ├── xgboost_predictor.py XGBoost flood probability
│   │   │   └── unet_segmentor.py    U-Net flood inundation mask
│   │   │
│   │   ├── gis/                  GIS processing engine
│   │   │   └── flood_risk_fusion.py mask→polygons, spatial overlay, priorities
│   │   │
│   │   ├── services/
│   │   │   ├── osm_service.py       OSM hydrology + infrastructure
│   │   │   ├── dem_service.py       Terrain (elevation, slope)
│   │   │   ├── rainfall_service.py  Live rain (Open-Meteo + RainViewer)
│   │   │   ├── soil_service.py      Soil properties (SoilGrids)
│   │   │   ├── risk_engine.py       Rule-based weighted-sum (MVP fallback)
│   │   │   └── decision_engine.py   Severity / alerts / evacuation routing
│   │   │
│   │   ├── models/
│   │   │   └── schemas.py        Pydantic response models
│   │   │
│   │   └── utils/
│   │       └── grid.py           150m grid builder
│   │
│   ├── celery_worker.py          Background AI task queue (Redis broker)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── ml_models/
│   ├── train_lstm.py             Train PyTorch LSTM rainfall forecaster
│   ├── train_unet.py             Train PyTorch U-Net flood segmentor
│   ├── train_susceptibility.py   Train XGBoost flood probability model
│   │
│   ├── lstm.pt                   ← generated by train_lstm.py
│   ├── unet.pt                   ← generated by train_unet.py
│   └── flood_susceptibility.json ← generated by train_susceptibility.py
│
├── data_processing/
│   └── build_training_table.py   Offline feature export (reuses backend services)
│
├── database/
│   └── schema.sql                PostGIS tables: rainfall, villages, rivers,
│                                 roads, hospitals, flood_predictions, alerts, shelters
│
├── frontend/                     React (Vite) dashboard, Leaflet map
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/           MapView, RiskHeatmap, AlertPanel, VillagePanel
│   │   └── services/api.js
│   └── Dockerfile
│
├── docker-compose.yml            postgres + redis + backend + celery + frontend + nginx
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/risk-map/{district}` | Rule-based weighted risk map (fast, no AI models needed) |
| `GET` | `/api/v1/current-conditions/{lat}/{lon}` | Point-level weather + soil snapshot |
| `POST` | `/api/v1/predict?district_name={district}` | **Full AI pipeline** (LSTM + XGBoost + optional U-Net) |
| `GET` | `/api/v1/evacuation-route?village={v}` | Nearest safe shelter routing |
| `GET` | `/api/v1/infrastructure-risk?lat=&lon=` | Hospitals + shelters at risk near a point |
| `GET` | `/api/v1/alerts` | Active alerts |
| `POST` | `/api/v1/alerts/send` | Push a new alert |
| `GET` | `/api/v1/villages/{district}` | Village risk summary |

---

## Quick Start (Local, No Docker)

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # add a free OpenTopography key for the terrain layer
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** — interactive Swagger UI for all endpoints.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**.

### 3. Try the full pipeline

```bash
# Rule-based risk map (no model files needed)
curl http://localhost:8000/api/v1/risk-map/Chennai

# Full AI pipeline (XGBoost fallback runs even without trained models)
curl -X POST "http://localhost:8000/api/v1/predict?district_name=Chennai"

# Evacuation route
curl "http://localhost:8000/api/v1/evacuation-route?village=Koyambedu&lat=13.07&lon=80.20"
```

---

## Quick Start (Docker)

```bash
cp backend/.env.example backend/.env
docker compose up --build
# Production (adds Nginx):
docker compose --profile production up --build
```

- Backend → http://localhost:8000
- Frontend → http://localhost:3000
- Redis → localhost:6379

### Celery worker (background jobs)

```bash
# In a separate terminal after docker compose up redis:
celery -A celery_worker worker --loglevel=info
```

---

## Training the AI Models

### Step 1 — Build feature table (X side)

```bash
python data_processing/build_training_table.py \
    --district "Chennai, India" \
    --out data/chennai_grid.csv
```

### Step 2a — Label with historical floods, then train XGBoost

```bash
# Join flood labels onto grid_id (e.g. from NDMA/NRSC reports)
python ml_models/train_susceptibility.py \
    --data data/chennai_grid_labeled.csv \
    --out  ml_models/flood_susceptibility.json
```

### Step 2b — Train LSTM (needs hourly rainfall CSV)

```bash
python ml_models/train_lstm.py \
    --data data/hourly_rainfall.csv \
    --out  ml_models/lstm.pt
```

### Step 2c — Train U-Net (needs Sentinel-1 patches + masks)

```bash
python ml_models/train_unet.py \
    --images data/sentinel1_patches/ \
    --masks  data/flood_masks/ \
    --out    ml_models/unet.pt \
    --in-channels 4   # 3 SAR bands + DEM
```

> **Note**: All models have graceful fallbacks. If a model file is absent,
> the corresponding service logs a warning and falls back to a rule-based
> or linear approximation, so the API stays functional during development.

---

## Free Data Sources

| Service | Layer | Key needed |
|---|---|---|
| OpenStreetMap (osmnx) | Hydrology + infrastructure | None |
| RainViewer | Live radar metadata | None |
| Open-Meteo | Forecast + soil moisture | None |
| SoilGrids | Soil permeability | None |
| OpenTopography | SRTM elevation/slope | Free signup: https://portal.opentopography.org |
| Sentinel Hub | Sentinel-1 SAR (U-Net) | Free tier: https://www.sentinel-hub.com |

---

## Extending

- **Persist predictions to PostGIS**: `database/schema.sql` has all tables ready.
  Swap the in-memory routers for real DB queries using asyncpg or SQLAlchemy.
- **Sentinel-1 flood verification**: Query Sentinel Hub for VV/VH backscatter,
  threshold for water, and overlay as a second GeoJSON layer.
- **Village boundaries**: Load Survey of India / Bhuvan boundary polygons into
  the `villages` table and spatially join to the grid.
- **Flutter app**: The `/api/v1/alerts` and `/api/v1/evacuation-route` endpoints
  are lightweight enough for mobile consumption without modification.
- **SMS / FCM dispatch**: Hook `decision_engine.generate_alerts()` results into
  Twilio or Firebase Cloud Messaging inside the Celery task.

---

## Accuracy Notes

The 150m grid and the weighted-sum `RiskEngine` are **demo/hackathon-grade**.
For operational use: use ALOS PALSAR 12.5m DEM, Sentinel-1 U-Net verification,
and XGBoost trained on real historical flood labels rather than hand-picked weights.
