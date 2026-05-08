from __future__ import annotations

import math

from models.schemas import CascadeResult, ChainCalculationRequest, PerStageResult, RFComponent

K_BOLTZMANN = 1.380649e-23  # J/K


def db_to_linear(db: float) -> float:
    return 10 ** (db / 10)


def linear_to_db(x: float) -> float:
    return 10 * math.log10(x)


def dbm_to_mw(dbm: float) -> float:
    return 10 ** (dbm / 10)


def mw_to_dbm(mw: float) -> float:
    return 10 * math.log10(mw)


def cascaded_nf(stages: list[RFComponent]) -> float:
    """Returns cascaded noise figure in dB using Friis formula."""
    if not stages:
        raise ValueError("Chain must have at least one stage")

    nf_db = max(stages[0].nf_db, 0.0)
    f_cascade = db_to_linear(nf_db)
    cumulative_gain = db_to_linear(stages[0].gain_db)

    for stage in stages[1:]:
        nf_db = max(stage.nf_db, 0.0)
        f_cascade += (db_to_linear(nf_db) - 1) / cumulative_gain
        cumulative_gain *= db_to_linear(stage.gain_db)

    return linear_to_db(f_cascade)


def cascaded_gain(stages: list[RFComponent]) -> float:
    """Returns total gain in dB (algebraic sum of all stage gains)."""
    return sum(s.gain_db for s in stages)


def per_stage_cumulative(stages: list[RFComponent]) -> list[PerStageResult]:
    """Returns cumulative gain, NF, and IIP3 at each stage."""
    if not stages:
        raise ValueError("Chain must have at least one stage")

    results: list[PerStageResult] = []
    f_cascade = db_to_linear(max(stages[0].nf_db, 0.0))
    cum_gain_db = stages[0].gain_db
    cumulative_gain_linear = db_to_linear(stages[0].gain_db)

    # Cascaded IIP3 (input-referred) accumulated stage by stage
    def _iip3_safe(stage: RFComponent) -> float | None:
        try:
            mw = dbm_to_mw(stage.iip3_dbm)
            return mw if mw > 0 else None
        except Exception:
            return None

    iip3_0 = _iip3_safe(stages[0])
    inv_iip3 = (1.0 / iip3_0) if iip3_0 else None
    cum_gain_for_iip3 = db_to_linear(stages[0].gain_db)  # gain accumulated BEFORE next stage

    results.append(PerStageResult(
        stage_index=0,
        component_id=stages[0].id,
        component_name=stages[0].name,
        cumulative_gain_db=cum_gain_db,
        cumulative_nf_db=linear_to_db(f_cascade),
        cumulative_iip3_dbm=mw_to_dbm(1.0 / inv_iip3) if inv_iip3 else None,
    ))

    for i, stage in enumerate(stages[1:], start=1):
        nf_linear = db_to_linear(max(stage.nf_db, 0.0))
        f_cascade += (nf_linear - 1) / cumulative_gain_linear
        cumulative_gain_linear *= db_to_linear(stage.gain_db)
        cum_gain_db += stage.gain_db

        # Update cascaded IIP3
        iip3_i = _iip3_safe(stage)
        if inv_iip3 is not None and iip3_i is not None:
            inv_iip3 += cum_gain_for_iip3 / iip3_i
        else:
            inv_iip3 = None
        cum_gain_for_iip3 *= db_to_linear(stage.gain_db)

        results.append(PerStageResult(
            stage_index=i,
            component_id=stage.id,
            component_name=stage.name,
            cumulative_gain_db=cum_gain_db,
            cumulative_nf_db=linear_to_db(f_cascade),
            cumulative_iip3_dbm=mw_to_dbm(1.0 / inv_iip3) if inv_iip3 else None,
        ))

    return results


def cascaded_iip3(stages: list[RFComponent]) -> float:
    """Returns cascaded input IP3 in dBm."""
    if not stages:
        raise ValueError("Chain must have at least one stage")

    inv_iip3 = 0.0
    cumulative_gain_linear = 1.0

    for stage in stages:
        iip3_mw = dbm_to_mw(stage.iip3_dbm)
        if iip3_mw <= 0:
            raise ValueError(f"IIP3 must be > 0 mW (got {stage.iip3_dbm} dBm for {stage.name})")
        inv_iip3 += cumulative_gain_linear / iip3_mw
        cumulative_gain_linear *= db_to_linear(stage.gain_db)

    return mw_to_dbm(1.0 / inv_iip3)


def receiver_sensitivity(
    cascaded_nf_db: float,
    bandwidth_hz: float,
    temperature_k: float = 290.0,
) -> float:
    """Returns minimum detectable signal (MDS) in dBm."""
    noise_floor_dbm = 10 * math.log10(K_BOLTZMANN * temperature_k * bandwidth_hz) + 30
    return noise_floor_dbm + cascaded_nf_db


def _warn_suspicious_params(stages: list[RFComponent]) -> None:
    import logging
    logger = logging.getLogger(__name__)
    for s in stages:
        if s.nf_db < 0:
            logger.warning("Stage '%s': nf_db=%.1f is negative (clamped to 0)", s.name, s.nf_db)
        if not (-60 <= s.gain_db <= 60):
            logger.warning("Stage '%s': gain_db=%.1f outside typical range [-60, 60]", s.name, s.gain_db)


def calculate_chain(request: ChainCalculationRequest) -> CascadeResult:
    """Full cascade calculation entry point."""
    stages = request.stages
    params = request.system_params

    if not stages:
        raise ValueError("Chain must have at least one stage")
    if params.bandwidth_hz <= 0:
        raise ValueError("bandwidth_hz must be positive")
    if params.temperature_k <= 0:
        raise ValueError("temperature_k must be positive")

    _warn_suspicious_params(stages)

    nf_db = cascaded_nf(stages)
    gain_db = cascaded_gain(stages)
    iip3_dbm = cascaded_iip3(stages)
    sensitivity = receiver_sensitivity(nf_db, params.bandwidth_hz, params.temperature_k)
    per_stage = per_stage_cumulative(stages)

    return CascadeResult(
        total_gain_db=gain_db,
        cascaded_nf_db=nf_db,
        cascaded_iip3_dbm=iip3_dbm,
        sensitivity_dbm=sensitivity,
        per_stage=per_stage,
    )
