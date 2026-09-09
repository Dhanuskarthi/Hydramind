from typing import Any, Optional
from pydantic import BaseModel


class RiskMapMetadata(BaseModel):
    district: str
    grid_size_m: int
    total_cells: int
    timestamp: str
    risk_distribution: dict


class RiskMapResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list
    metadata: RiskMapMetadata


class CurrentConditions(BaseModel):
    location: dict
    rainfall: dict
    forecast: dict
    soil: Optional[dict] = None
    timestamp: str


class Alert(BaseModel):
    id: int
    type: str
    severity: str
    village: str
    message: str
    timestamp: str


class Village(BaseModel):
    name: str
    risk_level: str
    population: Optional[int] = None
