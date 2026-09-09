"""
HydraMind - real-time, village-level flood risk mapping.

Architecture (see README.md for the full diagram):

    OpenStreetMap ---> hydrology + infrastructure  --\
    OpenTopography -> terrain (elevation/slope)      --> 150m grid --> Risk Engine --> GeoJSON --> React/Flutter
    RainViewer/Open-Meteo -> live rainfall + soil    --/
    SoilGrids -> soil permeability                  --/

Run with:
    uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from app.config import settings
from app.routers import risk, alerts, villages, predict, evacuation, historical

app = FastAPI(
    title="HydraMind Flood Risk API",
    description="Real-time, village-level flood risk mapping built on free/open data sources.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(risk.router)
app.include_router(alerts.router)
app.include_router(villages.router)
app.include_router(predict.router)
app.include_router(evacuation.router)
app.include_router(historical.router)


@app.get("/")
async def root():
    return {
        "name": "HydraMind Flood Risk API",
        "status": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "docs": "/docs",
        "endpoints": [
            "GET  /api/v1/risk-map/{district_name}",
            "GET  /api/v1/current-conditions/{lat}/{lon}",
            "GET  /api/v1/alerts",
            "POST /api/v1/alerts/send",
            "GET  /api/v1/villages/{district_name}",
            "POST /api/v1/predict",
            "GET  /api/v1/evacuation-route",
            "GET  /api/v1/infrastructure-risk",
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
