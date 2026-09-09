from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["alerts"])

# In-memory demo store. Replace with a PostGIS table + real dispatch
# (SMS/WhatsApp/push) once this moves past the prototype stage.
_ALERTS = [
    {
        "id": 1,
        "type": "FLOOD_WARNING",
        "severity": "HIGH",
        "village": "Sample Village",
        "message": "Heavy rainfall expected in the next 3 hours. Move valuables to higher ground.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
]


@router.get("/alerts")
async def get_alerts():
    return _ALERTS


@router.post("/alerts/send")
async def send_alert(alert: dict):
    alert["id"] = len(_ALERTS) + 1
    alert.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    _ALERTS.append(alert)
    return {"status": "queued", "alert": alert}
