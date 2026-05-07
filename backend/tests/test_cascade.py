"""
Unit tests for cascade.py — all assertions verified by hand calculation.

Reference formulas (Friis):
  F_cascade = F0 + (F1-1)/G0 + (F2-1)/(G0*G1) + ...
  IIP3_cascade: 1/IIP3 = 1/IIP30 + G0/IIP31 + ...
  Sensitivity = 10*log10(k*T*B) + 30 + NF_cascade
"""
import math
import pytest

from models.schemas import ChainCalculationRequest, RFComponent, SystemParams
from services.cascade import (
    K_BOLTZMANN,
    cascaded_gain,
    cascaded_iip3,
    cascaded_nf,
    calculate_chain,
    per_stage_cumulative,
    receiver_sensitivity,
)

TOLERANCE = 0.01  # dB


def make_component(
    name: str,
    gain_db: float,
    nf_db: float,
    iip3_dbm: float,
    p1db_dbm: float = 10.0,
    comp_type: str = "Generic",
) -> RFComponent:
    return RFComponent(
        id=name,
        name=name,
        type=comp_type,
        gain_db=gain_db,
        nf_db=nf_db,
        iip3_dbm=iip3_dbm,
        p1db_dbm=p1db_dbm,
    )


# ---------------------------------------------------------------------------
# Test 1: Two-stage LNA + Amplifier — hand-calculated reference
# LNA:  Gain=15 dB, NF=1.5 dB, IIP3=-5 dBm
# AMP:  Gain=10 dB, NF=5 dB,   IIP3=+10 dBm
# ---------------------------------------------------------------------------
LNA = make_component("LNA", gain_db=15.0, nf_db=1.5, iip3_dbm=-5.0)
AMP = make_component("AMP", gain_db=10.0, nf_db=5.0, iip3_dbm=10.0)

# Hand calc:
#   F0 = 10^(1.5/10) = 1.41254
#   F1 = 10^(5.0/10) = 3.16228
#   G0 = 10^(15/10)  = 31.6228
#   F_cas = 1.41254 + (3.16228 - 1) / 31.6228 = 1.41254 + 0.06832 = 1.48086
#   NF_cas = 10*log10(1.48086) = 1.7061 dB
NF_TWO_STAGE_REF = 10 * math.log10(
    10 ** (1.5 / 10) + (10 ** (5.0 / 10) - 1) / 10 ** (15.0 / 10)
)

# Gain = 15 + 10 = 25 dB
GAIN_TWO_STAGE_REF = 25.0

# IIP3: 1/IIP3_cas = 1/IIP30 + G0/IIP31
#   IIP30 = 10^(-5/10) = 0.31623 mW
#   IIP31 = 10^(10/10) = 10.0 mW
#   G0    = 31.6228
#   1/IIP3_cas = 1/0.31623 + 31.6228/10.0 = 3.16228 + 3.16228 = 6.32456
#   IIP3_cas = 1/6.32456 = 0.15811 mW → 10*log10(0.15811) = -8.0103 dBm
IIP3_TWO_STAGE_REF = 10 * math.log10(
    1.0 / (1.0 / 10 ** (-5.0 / 10) + 10 ** (15.0 / 10) / 10 ** (10.0 / 10))
)


def test_two_stage_nf():
    result = cascaded_nf([LNA, AMP])
    assert abs(result - NF_TWO_STAGE_REF) < TOLERANCE


def test_two_stage_gain():
    result = cascaded_gain([LNA, AMP])
    assert abs(result - GAIN_TWO_STAGE_REF) < TOLERANCE


def test_two_stage_iip3():
    result = cascaded_iip3([LNA, AMP])
    assert abs(result - IIP3_TWO_STAGE_REF) < TOLERANCE


# ---------------------------------------------------------------------------
# Test 2: Single stage — cascade equals stage values
# ---------------------------------------------------------------------------
SINGLE = make_component("S1", gain_db=20.0, nf_db=2.0, iip3_dbm=5.0)


def test_single_stage_nf():
    assert abs(cascaded_nf([SINGLE]) - 2.0) < TOLERANCE


def test_single_stage_gain():
    assert abs(cascaded_gain([SINGLE]) - 20.0) < TOLERANCE


def test_single_stage_iip3():
    assert abs(cascaded_iip3([SINGLE]) - 5.0) < TOLERANCE


# ---------------------------------------------------------------------------
# Test 3: High-gain first stage dominates — 30 dB LNA makes 2nd stage negligible
# After a 30 dB LNA (NF=1 dB), a second stage with NF=10 dB contributes < 0.1 dB
# ---------------------------------------------------------------------------
def test_high_gain_first_stage_dominance():
    lna_30db = make_component("LNA30", gain_db=30.0, nf_db=1.0, iip3_dbm=-10.0)
    noisy_stage = make_component("NOISY", gain_db=5.0, nf_db=10.0, iip3_dbm=20.0)
    nf_two = cascaded_nf([lna_30db, noisy_stage])
    nf_one = cascaded_nf([lna_30db])
    # Second stage contribution: (F2-1)/G0 = (10-1)/1000 = 0.009 → ~0.039 dB
    assert abs(nf_two - nf_one) < 0.1


# ---------------------------------------------------------------------------
# Test 4: Attenuator first — NF equals insertion loss (passive Friis: F = 1/G)
# 6 dB attenuator: G = -6 dB → linear G = 0.25
# Friis for passive: F = 1/G = 4 → NF = 6 dB
# ---------------------------------------------------------------------------
def test_attenuator_nf_equals_loss():
    att = make_component("ATT", gain_db=-6.0, nf_db=6.0, iip3_dbm=40.0)
    nf = cascaded_nf([att])
    assert abs(nf - 6.0) < TOLERANCE


# ---------------------------------------------------------------------------
# Test 5: Sensitivity at 290K, 1 MHz BW with NF=0 dB → ~-114 dBm
# Thermal noise floor: 10*log10(1.380649e-23 * 290 * 1e6) + 30 = -114.0 dBm
# ---------------------------------------------------------------------------
def test_sensitivity_thermal_floor():
    expected = 10 * math.log10(K_BOLTZMANN * 290.0 * 1e6) + 30
    result = receiver_sensitivity(0.0, bandwidth_hz=1e6, temperature_k=290.0)
    assert abs(result - expected) < TOLERANCE
    assert abs(result - (-114.0)) < 0.1  # thermal noise floor sanity check


def test_sensitivity_with_nf():
    # NF=3 dB should shift sensitivity by exactly 3 dB
    sens_0 = receiver_sensitivity(0.0, bandwidth_hz=1e6, temperature_k=290.0)
    sens_3 = receiver_sensitivity(3.0, bandwidth_hz=1e6, temperature_k=290.0)
    assert abs(sens_3 - sens_0 - 3.0) < TOLERANCE


# ---------------------------------------------------------------------------
# Test 6: Empty chain raises ValueError
# ---------------------------------------------------------------------------
def test_empty_chain_nf():
    with pytest.raises(ValueError):
        cascaded_nf([])


def test_empty_chain_gain():
    # cascaded_gain on empty list returns 0 (sum of empty), not an error
    assert cascaded_gain([]) == 0.0


def test_empty_chain_iip3():
    with pytest.raises(ValueError):
        cascaded_iip3([])


def test_empty_chain_per_stage():
    with pytest.raises(ValueError):
        per_stage_cumulative([])


# ---------------------------------------------------------------------------
# Test 7: per_stage_cumulative correctness
# ---------------------------------------------------------------------------
def test_per_stage_cumulative():
    stages = [LNA, AMP]
    result = per_stage_cumulative(stages)
    assert len(result) == 2
    # Stage 0: cumulative = LNA alone
    assert abs(result[0].cumulative_gain_db - 15.0) < TOLERANCE
    assert abs(result[0].cumulative_nf_db - 1.5) < TOLERANCE
    # Stage 1: cumulative = full two-stage
    assert abs(result[1].cumulative_gain_db - 25.0) < TOLERANCE
    assert abs(result[1].cumulative_nf_db - NF_TWO_STAGE_REF) < TOLERANCE


# ---------------------------------------------------------------------------
# Test 8: calculate_chain integration
# ---------------------------------------------------------------------------
def test_calculate_chain_full():
    request = ChainCalculationRequest(
        stages=[LNA, AMP],
        system_params=SystemParams(bandwidth_hz=20e6, temperature_k=290.0),
    )
    result = calculate_chain(request)
    assert abs(result.total_gain_db - GAIN_TWO_STAGE_REF) < TOLERANCE
    assert abs(result.cascaded_nf_db - NF_TWO_STAGE_REF) < TOLERANCE
    assert abs(result.cascaded_iip3_dbm - IIP3_TWO_STAGE_REF) < TOLERANCE
    assert len(result.per_stage) == 2


def test_calculate_chain_invalid_bandwidth():
    request = ChainCalculationRequest(
        stages=[LNA],
        system_params=SystemParams(bandwidth_hz=0, temperature_k=290.0),
    )
    with pytest.raises(ValueError, match="bandwidth_hz"):
        calculate_chain(request)


def test_calculate_chain_invalid_temperature():
    request = ChainCalculationRequest(
        stages=[LNA],
        system_params=SystemParams(bandwidth_hz=1e6, temperature_k=0),
    )
    with pytest.raises(ValueError, match="temperature_k"):
        calculate_chain(request)
