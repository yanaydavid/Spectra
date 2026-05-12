from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ComponentType(str, Enum):
    # Amplifiers
    LNA         = "LNA"
    AMPLIFIER   = "Amplifier"
    PA          = "PA"
    VGA         = "VGA"
    LIMITER     = "Limiter"
    # Filters
    BPF         = "BPF"
    LPF         = "LPF"
    HPF         = "HPF"
    BSF         = "BSF"
    DIPLEXER    = "Diplexer"
    # Attenuators & passive
    ATTENUATOR  = "Attenuator"
    SPLITTER    = "Splitter"
    COUPLER     = "Coupler"
    CIRCULATOR  = "Circulator"
    ISOLATOR    = "Isolator"
    TERMINATION = "Termination"
    # Phase
    PHASESHIFTER = "PhaseShifter"
    HYBRID90    = "Hybrid90"
    HYBRID180   = "Hybrid180"
    BALUN       = "Balun"
    # Frequency conversion
    MIXER       = "Mixer"
    UPCONVERTER = "UpConverter"
    MULTIPLIER  = "Multiplier"
    DIVIDER     = "Divider"
    # Oscillators
    VCO         = "VCO"
    VCXO        = "VCXO"
    PLL         = "PLL"
    CRYSTALOSC  = "CrystalOsc"
    # Switches
    SWITCH      = "Switch"
    TRSWITCH    = "TRSwitch"
    # Digital
    ADC         = "ADC"
    DAC         = "DAC"
    # Antenna
    ANTENNA     = "Antenna"
    # Generic
    GENERIC     = "Generic"


class RFComponent(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str
    name: str
    type: ComponentType
    gain_db: float
    nf_db: float
    iip3_dbm: Optional[float] = None
    p1db_dbm: Optional[float] = None


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
    cumulative_iip3_dbm: Optional[float] = None


class CascadeResult(BaseModel):
    total_gain_db: float
    cascaded_nf_db: float
    cascaded_iip3_dbm: Optional[float] = None
    sensitivity_dbm: float
    per_stage: list[PerStageResult]


class ExtractedParams(BaseModel):
    name: str
    gain_db: Optional[float] = None
    nf_db: Optional[float] = None
    iip3_dbm: Optional[float] = None
    p1db_dbm: Optional[float] = None
    extraction_notes: Optional[str] = None
