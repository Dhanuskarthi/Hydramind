"""
Dynamic weather layer - the part OSM cannot provide.

Two free, key-less APIs are combined:
  * RainViewer  -> live radar, ~2 minute updates, best for "is it raining now"
  * Open-Meteo  -> forecast + soil moisture, ~15 minute updates

Both are queried concurrently and fused into one dict per location.
"""
import logging
from datetime import datetime
import aiohttp

logger = logging.getLogger(__name__)

RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


class RainfallService:
    async def get_current_rainfall(self, lat: float, lon: float) -> dict:
        """
        RainViewer's public endpoint returns tile paths, not point values.
        Decoding the actual radar tile for a lat/lon needs a raster fetch +
        colour decode (see docs/rainviewer_tile_decode.md for the full
        implementation). For the MVP grid-level score we treat the fused
        Open-Meteo current precipitation as the primary real-time number
        and keep this call to expose RainViewer's freshness metadata.
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(RAINVIEWER_URL, timeout=15) as resp:
                    data = await resp.json()

            past = data.get("radar", {}).get("past", [])
            nowcast = data.get("radar", {}).get("nowcast", [])
            latest = past[-1] if past else None

            return {
                "radar_available": latest is not None,
                "radar_last_updated": (
                    datetime.utcfromtimestamp(latest["time"]).isoformat() + "Z"
                    if latest else None
                ),
                "nowcast_frames": len(nowcast),
                "source": "RainViewer",
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("RainViewer fetch failed: %s", exc)
            return {"radar_available": False, "source": "RainViewer", "error": str(exc)}

    async def get_forecast(self, lat: float, lon: float) -> dict:
        """Current precipitation, soil moisture and short-term forecast."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "precipitation,rain,soil_moisture_0_to_1cm,relative_humidity_2m,temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
            "hourly": "precipitation,precipitation_probability",
            "timezone": "auto",
            "past_days": 7,
            "forecast_days": 2,
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(OPEN_METEO_URL, params=params, timeout=15) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        raise Exception(f"HTTP {resp.status}: {text}")
                    data = await resp.json()

            current = data.get("current", {})
            hourly = data.get("hourly", {})
            precip_series = hourly.get("precipitation", [])

            return {
                "current_rainfall_mm": current.get("precipitation", 0.0),
                "soil_moisture_pct": (current.get("soil_moisture_0_to_1cm") or 0.0) * 100,
                "humidity_pct": current.get("relative_humidity_2m"),
                "celsius": current.get("temperature_2m", 0.0),
                "feels_like_c": current.get("apparent_temperature", 0.0),
                "wind_speed_kmh": current.get("wind_speed_10m", 0.0),
                "wind_direction_deg": current.get("wind_direction_10m", 0.0),
                "wind_gusts_kmh": current.get("wind_gusts_10m", 0.0),
                "rainfall_1hr_mm": precip_series[0] if precip_series else 0.0,
                "rainfall_3hr_mm": sum(precip_series[:3]) if precip_series else 0.0,
                "rainfall_24hr_mm": sum(precip_series[:24]) if precip_series else 0.0,
                "precipitation_probability_pct": (
                    hourly.get("precipitation_probability", [0])[0]
                    if hourly.get("precipitation_probability") else 0
                ),
                "hourly_precipitation": precip_series,
                "source": "Open-Meteo",
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Open-Meteo fetch failed: %s", exc)
            return {
                "current_rainfall_mm": 0.0,
                "soil_moisture_pct": 0.0,
                "source": "Open-Meteo",
                "error": str(exc),
            }
