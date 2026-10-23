"""
Central configuration for HydraMind.
All values can be overridden via a `.env` file (copy `.env.example` -> `.env`).
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    GRID_SIZE_METERS: int = int(os.getenv("GRID_SIZE_METERS", "150"))
    DEFAULT_DISTRICT: str = os.getenv("DEFAULT_DISTRICT", "The Nilgiris, India")

    OPENTOPOGRAPHY_API_KEY: str = os.getenv("OPENTOPOGRAPHY_API_KEY", "")
    SENTINEL_HUB_CLIENT_ID: str = os.getenv("SENTINEL_HUB_CLIENT_ID", "")
    SENTINEL_HUB_CLIENT_SECRET: str = os.getenv("SENTINEL_HUB_CLIENT_SECRET", "")

    ALLOWED_ORIGINS: list = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")

    RISK_THRESHOLDS = {
        "MINIMAL": 0.0,
        "LOW": 0.25,
        "MEDIUM": 0.45,
        "HIGH": 0.65,
        "CRITICAL": 0.85,
    }

    RISK_WEIGHTS = {
        "dist_to_river": 0.22,
        "elevation": 0.13,
        "drainage_density": 0.10,
        "building_density": 0.08,
        "impervious_pct": 0.07,
        "current_rainfall": 0.25,
        "soil_moisture": 0.15,
    }


settings = Settings()
