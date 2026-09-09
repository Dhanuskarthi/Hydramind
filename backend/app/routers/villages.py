from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["villages"])

# Demo data. In production, join grid_cells to a village-boundary table
# (Survey of India / Bhuvan) in PostGIS and aggregate risk per village.
_VILLAGES = {
    "Chennai": [
        {"name": "Kotturpuram", "risk_level": "HIGH", "population": 8200},
        {"name": "Velachery", "risk_level": "CRITICAL", "population": 15400},
        {"name": "Adyar", "risk_level": "MEDIUM", "population": 11200},
    ]
}


@router.get("/villages/{district_name}")
async def get_villages(district_name: str):
    return {
        "district": district_name,
        "villages": _VILLAGES.get(district_name, []),
    }
