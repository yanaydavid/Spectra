"""
Tests for pdf_parser.py.

Unit tests run without a real API key (mock Claude responses).
Integration tests marked with @pytest.mark.integration require:
  - ANTHROPIC_API_KEY set in backend/.env
  - Real datasheet PDFs in tests/fixtures/
Run integration tests: pytest -m integration
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from models.schemas import ExtractedParams
from services.pdf_parser import ExtractionError, _strip_fences, extract_params_from_pdf

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Unit tests — mock Claude API
# ---------------------------------------------------------------------------

def _make_mock_message(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock()]
    msg.content[0].text = text
    return msg


def _call_with_mock_response(response_text: str) -> ExtractedParams:
    with patch("services.pdf_parser.anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_message(response_text)

        with patch("services.pdf_parser.settings") as mock_settings:
            mock_settings.anthropic_api_key = "sk-test-fake-key"
            return extract_params_from_pdf(b"%PDF-fake-bytes")


def test_clean_json_response():
    payload = {
        "name": "HMC1002",
        "gain_db": 15.5,
        "nf_db": 0.8,
        "iip3_dbm": -5.0,
        "p1db_dbm": -15.0,
        "extraction_notes": "Values from Table 1",
    }
    result = _call_with_mock_response(json.dumps(payload))
    assert result.name == "HMC1002"
    assert result.gain_db == 15.5
    assert result.nf_db == 0.8
    assert result.iip3_dbm == -5.0
    assert result.p1db_dbm == -15.0


def test_json_with_markdown_fences():
    payload = {"name": "SKY65017", "gain_db": 12.0, "nf_db": 1.2,
               "iip3_dbm": -8.0, "p1db_dbm": -18.0, "extraction_notes": "Test"}
    wrapped = f"```json\n{json.dumps(payload)}\n```"
    result = _call_with_mock_response(wrapped)
    assert result.gain_db == 12.0


def test_null_fields_allowed():
    payload = {"name": "Unknown Part", "gain_db": None, "nf_db": None,
               "iip3_dbm": None, "p1db_dbm": None, "extraction_notes": "No params found"}
    result = _call_with_mock_response(json.dumps(payload))
    assert result.gain_db is None
    assert result.nf_db is None


def test_non_json_response_raises_extraction_error():
    with pytest.raises(ExtractionError, match="non-JSON"):
        _call_with_mock_response("I could not find the parameters in this document.")


def test_missing_api_key_raises():
    with patch("services.pdf_parser.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        with pytest.raises(ExtractionError, match="ANTHROPIC_API_KEY"):
            extract_params_from_pdf(b"%PDF-fake")


def test_strip_fences():
    assert _strip_fences('```json\n{"a": 1}\n```') == '{"a": 1}'
    assert _strip_fences('```\n{"a": 1}\n```') == '{"a": 1}'
    assert _strip_fences('{"a": 1}') == '{"a": 1}'
    assert _strip_fences('  {"a": 1}  ') == '{"a": 1}'


# ---------------------------------------------------------------------------
# Integration tests — require real API key + fixture PDFs
# ---------------------------------------------------------------------------

def _load_fixture(filename: str) -> bytes:
    path = FIXTURES_DIR / filename
    if not path.exists():
        pytest.skip(f"Fixture not found: {path}")
    return path.read_bytes()


@pytest.mark.integration
def test_real_lna_datasheet():
    """
    Fixture: tests/fixtures/lna_datasheet.pdf
    Expected (manually verified from the datasheet):
      gain_db  ≈ expected gain ± 2 dB
      nf_db    ≈ expected NF   ± 1 dB
    Update the expected values to match your fixture file.
    """
    pdf_bytes = _load_fixture("lna_datasheet.pdf")
    result = extract_params_from_pdf(pdf_bytes)

    assert result.name is not None and len(result.name) > 0
    assert result.gain_db is not None, "Gain should be extractable from an LNA datasheet"
    assert result.nf_db is not None, "NF should be extractable from an LNA datasheet"
    # Sanity range checks for a typical LNA
    assert 0 < result.gain_db < 40, f"Gain {result.gain_db} dB outside typical LNA range"
    assert 0 < result.nf_db < 10, f"NF {result.nf_db} dB outside typical LNA range"


@pytest.mark.integration
def test_real_attenuator_datasheet():
    """
    Fixture: tests/fixtures/attenuator_datasheet.pdf
    Attenuator: gain_db should be negative.
    """
    pdf_bytes = _load_fixture("attenuator_datasheet.pdf")
    result = extract_params_from_pdf(pdf_bytes)

    assert result.gain_db is not None
    assert result.gain_db < 0, f"Attenuator gain should be negative, got {result.gain_db}"


@pytest.mark.integration
def test_real_amplifier_datasheet():
    """
    Fixture: tests/fixtures/amplifier_datasheet.pdf
    """
    pdf_bytes = _load_fixture("amplifier_datasheet.pdf")
    result = extract_params_from_pdf(pdf_bytes)

    assert result.name is not None
    assert result.gain_db is not None
    assert result.gain_db > 0


@pytest.mark.integration
def test_malformed_pdf_raises():
    """A file that is not a valid PDF should raise ExtractionError."""
    with pytest.raises(ExtractionError):
        extract_params_from_pdf(b"this is not a pdf")
