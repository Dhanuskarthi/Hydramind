from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["villages"])

# Demo data. In production, join grid_cells to a village-boundary table
# (Survey of India / Bhuvan) in PostGIS and aggregate risk per village.
_VILLAGES = {
    "Nilgiris": [
        {"name": "Ooty (Udhagamandalam)", "risk_level": "HIGH", "population": 88000},
        {"name": "Coonoor", "risk_level": "CRITICAL", "population": 45000},
        {"name": "Kotagiri", "risk_level": "HIGH", "population": 38000},
        {"name": "Kallar", "risk_level": "CRITICAL", "population": 12000},
        {"name": "Gudalur", "risk_level": "MEDIUM", "population": 49000},
        {"name": "Ketti Valley", "risk_level": "HIGH", "population": 24000},
        {"name": "Aravenu", "risk_level": "HIGH", "population": 16000},
        {"name": "Burliyar", "risk_level": "CRITICAL", "population": 9500},
        {"name": "Emerald", "risk_level": "MEDIUM", "population": 14000},
        {"name": "Naduvattam", "risk_level": "HIGH", "population": 11000},
    ],
    "Chennai": [
        {"name": "Kotturpuram", "risk_level": "HIGH", "population": 8200},
        {"name": "Velachery", "risk_level": "CRITICAL", "population": 15400},
        {"name": "Adyar", "risk_level": "MEDIUM", "population": 11200},
    ],
}


@router.get("/villages/{district_name}")
async def get_villages(district_name: str):
    clean = district_name.strip()
    if clean in _VILLAGES:
        return {"district": clean, "villages": _VILLAGES[clean]}
    for k, v in _VILLAGES.items():
        if k.lower() in clean.lower() or clean.lower() in k.lower():
            return {"district": district_name, "villages": v}
    return {
        "district": district_name,
        "villages": _VILLAGES.get("Nilgiris", []),
    }
