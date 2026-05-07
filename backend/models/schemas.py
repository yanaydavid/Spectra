from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ComponentType(str, Enum):
    LNA = "LNA"
    AMPLIFIER = "Amplifier"
    ATTENUATOR = "Attenuator"
    MIXER = "Mixer"
    FILTER = "Filter"
    GENERIC = "Generic"


class RFComponent(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    name: str
    type: ComponentType
    gain_db: float
    nf_db: float
    iip3_dbm: float
    p1db_dbm: float


class SystemParams(BaseModel):
    bandwidth_hz: float
    temperature_k: float = 290.0


class ChainCalculationRequest(BaseModel):
    stages: list[RFComponent]
    system_params: SystemParams


class PerStageResult(BaseModel):
    stage_index: int
    component_id: str
    component_name: str
    cumulative_gain_db: float
    cumulative_nf_db: float


class CascadeResult(BaseModel):
    total_gain_db: float
    cascaded_nf_db: float
    cascaded_iip3_dbm: float
    sensitivity_dbm: float
    per_stage: list[PerStageResult]


class ExtractedParams(BaseModel):
    name: str
    gain_db: Optional[float] = None
    nf_db: Optional[float] = None
    iip3_dbm: Optional[float] = None
    p1db_dbm: Optional[float] = None
    extraction_notes: Optional[str] = None
