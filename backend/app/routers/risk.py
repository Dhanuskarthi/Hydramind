import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.osm_service import OSMService
from app.services.dem_service import DEMService
from app.services.rainfall_service import RainfallService
from app.services.soil_service import SoilService
from app.services.risk_engine import RiskEngine
from app.utils.grid import create_grid

router = APIRouter(prefix="/api/v1", tags=["risk"])

osm_service = OSMService()
dem_service = DEMService()
rainfall_service = RainfallService()
soil_service = SoilService()
risk_engine = RiskEngine()


@router.get("/risk-map/{district_name}")
async def get_risk_map(district_name: str):
    """
    End-to-end pipeline for one district:
    OSM (hydrology/infra) + DEM (terrain) + rainfall/soil (live)
    -> 150m grid -> weighted risk score -> GeoJSON.
    """
    place = f"{district_name}, India" if "india" not in district_name.lower() else district_name

    osm_data = osm_service.fetch_district_data(place)
    if osm_data is None:
        raise HTTPException(status_code=404, detail=f"Could not resolve district '{district_name}' on OpenStreetMap")

    bounds = tuple(osm_data["boundary"].total_bounds)
    grid = create_grid(bounds, cell_size_m=settings.GRID_SIZE_METERS)
    grid = osm_service.calculate_features(grid, osm_data)

    dem_src = dem_service.fetch_dem(bounds)
    grid = dem_service.calculate_terrain_features(grid, dem_src)

    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2
    rainfall = await rainfall_service.get_forecast(center_lat, center_lon)
    radar_meta = await rainfall_service.get_current_rainfall(center_lat, center_lon)
    soil = soil_service.get_soil_properties(center_lat, center_lon)

    grid = risk_engine.calculate_risk(grid, rainfall, soil)

    features = json.loads(grid.to_json())["features"]
    risk_distribution = grid["risk_level"].value_counts().to_dict()

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "district": district_name,
            "grid_size_m": settings.GRID_SIZE_METERS,
            "total_cells": len(grid),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "risk_distribution": risk_distribution,
            "rainfall_source": rainfall.get("source"),
            "radar": radar_meta,
        },
    }


@router.get("/current-conditions/{lat}/{lon}")
async def get_current_conditions(lat: float, lon: float):
    """Point-level real-time weather + soil snapshot (no grid needed)."""
    rainfall = await rainfall_service.get_forecast(lat, lon)
    radar_meta = await rainfall_service.get_current_rainfall(lat, lon)
    soil = soil_service.get_soil_properties(lat, lon)

    return {
        "location": {"lat": lat, "lon": lon},
        "rainfall": rainfall,
        "wind": {
            "speed_kmh": rainfall.get("wind_speed_kmh", 0),
            "direction_deg": rainfall.get("wind_direction_deg", 0),
            "gusts_kmh": rainfall.get("wind_gusts_kmh", 0),
        },
        "temperature": {
            "celsius": rainfall.get("celsius", 0),
            "feels_like_c": rainfall.get("feels_like_c", 0),
            "humidity_pct": rainfall.get("humidity_pct", 0),
        },
        "radar": radar_meta,
        "soil": soil,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
