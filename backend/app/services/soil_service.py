"""
Soil layer from ISRIC SoilGrids (free, key-less REST API).
Used to approximate infiltration / runoff potential.
"""
import logging
import requests

logger = logging.getLogger(__name__)

SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"


class SoilService:
    def get_soil_properties(self, lat: float, lon: float) -> dict:
        params = {
            "lon": lon,
            "lat": lat,
            "property": ["clay", "sand"],
            "depth": "0-5cm",
            "value": "mean",
        }
        try:
            resp = requests.get(SOILGRIDS_URL, params=params, timeout=15)
            resp.raise_for_status()
            layers = resp.json()["properties"]["layers"]

            values = {layer["name"]: layer["depths"][0]["values"]["mean"] for layer in layers}
            clay = values.get("clay", 0) / 10  # SoilGrids returns g/kg *10
            sand = values.get("sand", 0) / 10

            return {
                "clay_pct": clay,
                "sand_pct": sand,
                "permeability": self._estimate_permeability(clay, sand),
                "soil_type": self._classify(clay, sand),
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("SoilGrids fetch failed: %s", exc)
            return {"clay_pct": None, "sand_pct": None, "permeability": None, "soil_type": None}

    @staticmethod
    def _estimate_permeability(clay_pct: float, sand_pct: float) -> float:
        # crude heuristic: sandy soils drain faster, clay soils pond water
        return max(0.05, min(1.0, (sand_pct - clay_pct) / 100 + 0.5))

    @staticmethod
    def _classify(clay_pct: float, sand_pct: float) -> str:
        if clay_pct > 40:
            return "clay"
        if sand_pct > 70:
            return "sandy"
        if 20 <= clay_pct <= 40:
            return "loam"
        return "silty_loam"
