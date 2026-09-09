"""
/api/v1/evacuation-route  —  Safe evacuation route endpoint
============================================================
Returns the ordered list of safe shelters for one or more affected
villages, using the DecisionEngine's routing logic.

This is intentionally kept separate from /predict so the Flutter
citizen app can call it independently (lighter payload).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Query
from app.services.decision_engine import DecisionEngine

router = APIRouter(prefix="/api/v1", tags=["evacuation"])
decision = DecisionEngine()


@router.get("/evacuation-route")
async def get_evacuation_route(
    village: str = Query(..., description="Village name to route from"),
    lat: float = Query(None, description="Village centroid latitude (optional)"),
    lon: float = Query(None, description="Village centroid longitude (optional)"),
):
    """
    Returns evacuation routing for the given village.

    In the MVP the shelters list is demo data. Once PostGIS is populated
    with real shelter coordinates, this endpoint queries the shelters
    table and runs nearest-shelter logic automatically.
    """
    demo_shelters = [
        {"name": "Community Hall A", "geometry": {"coordinates": [lon + 0.02, lat + 0.02] if lat and lon else [80.29, 13.10]}},
        {"name": "Higher Ground School", "geometry": {"coordinates": [lon - 0.03, lat + 0.04] if lat and lon else [80.26, 13.12]}},
    ]
    village_centroids = {village: (lat, lon)} if lat and lon else None

    routes = decision.evacuation_routes(
        affected_villages=[village],
        safe_shelters=demo_shelters,
        village_centroids=village_centroids,
    )

    return {
        "village": village,
        "routes": routes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "Shelter data is demo. Replace with PostGIS query once real boundaries are loaded.",
    }
