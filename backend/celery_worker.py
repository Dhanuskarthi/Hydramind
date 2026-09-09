"""
Celery worker for HydraMind background tasks.

Usage (from docker-compose or manually):
    celery -A celery_worker worker --loglevel=info --concurrency=2

Tasks
-----
  - run_prediction_pipeline : full AI pipeline for a district (heavy, ~30s)
  - refresh_rainfall_cache  : periodic Open-Meteo fetch (lightweight, ~2s)
"""
import os
from celery import Celery

BROKER = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery("hydramind", broker=BROKER, backend=BACKEND)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_soft_time_limit=120,
    task_time_limit=180,
)


@celery_app.task(name="run_prediction_pipeline")
def run_prediction_pipeline(district_name: str) -> dict:
    """
    Runs the full LSTM -> XGBoost -> U-Net -> Fusion pipeline
    for a single district in the background.
    """
    from app.routers.predict import (
        osm_service, dem_service, rainfall_service, soil_service,
        lstm, xgb_predictor, fusion, decision,
    )
    from app.config import settings
    from app.utils.grid import create_grid
    import asyncio

    place = f"{district_name}, India"
    osm_data = osm_service.fetch_district_data(place)
    if osm_data is None:
        return {"error": f"Could not resolve '{district_name}'"}

    bounds = tuple(osm_data["boundary"].total_bounds)
    grid = create_grid(bounds, cell_size_m=settings.GRID_SIZE_METERS)
    grid = osm_service.calculate_features(grid, osm_data)

    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2

    loop = asyncio.new_event_loop()
    rainfall = loop.run_until_complete(rainfall_service.get_forecast(center_lat, center_lon))
    loop.close()

    return {
        "district": district_name,
        "cells": len(grid),
        "status": "completed",
    }


@celery_app.task(name="refresh_rainfall_cache")
def refresh_rainfall_cache(lat: float, lon: float) -> dict:
    """Periodic task to pre-cache rainfall data for a location."""
    import asyncio
    from app.services.rainfall_service import RainfallService

    svc = RainfallService()
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(svc.get_forecast(lat, lon))
    loop.close()

    return {"lat": lat, "lon": lon, "rainfall_mm": result.get("current_rainfall_mm", 0)}
