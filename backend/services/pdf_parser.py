from __future__ import annotations

import base64
import json
import re

import anthropic

from config import settings
from models.schemas import ExtractedParams

SYSTEM_PROMPT = """\
You are an expert RF/microwave engineer and datasheet analyst.
Your task is to extract specific RF performance parameters from component datasheets.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.
If a parameter cannot be found or is ambiguous, set its value to null.
All numeric values must be in the units specified in the schema.\
"""

USER_PROMPT = """\
Extract the following RF parameters from the attached datasheet PDF.

Return this exact JSON schema:
{
  "name": "<component part number or name>",
  "gain_db": <typical gain in dB, number or null>,
  "nf_db": <typical noise figure in dB, number or null>,
  "iip3_dbm": <typical input IP3 in dBm, number or null>,
  "p1db_dbm": <typical input P1dB in dBm, number or null>,
  "extraction_notes": "<brief note on where each value was found, or any ambiguity>"
}

Rules:
- Use TYPICAL values, not min/max, unless only min/max are available.
- Use room temperature (25°C) values when multiple temperature points are given.
- For gain: report small-signal gain. If the component is an attenuator or filter, gain will be negative.
- For noise figure: if only noise temperature is given, convert: NF = 10*log10(1 + T_noise/290).
- If IIP3 is given as OIP3, convert: IIP3 = OIP3 - Gain.
- Do not invent values. Return null if genuinely not present in the datasheet.\
"""


class ExtractionError(Exception):
    pass


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if model adds them despite instructions."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def extract_params_from_pdf(pdf_bytes: bytes) -> ExtractedParams:
    """
    Send a PDF datasheet to Claude and extract RF parameters.
    Raises ExtractionError on JSON parse failure or API error.
    """
    if not settings.anthropic_api_key:
        raise ExtractionError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": USER_PROMPT,
                        },
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError as e:
        raise ExtractionError(f"Invalid Anthropic API key: {e}") from e
    except anthropic.APITimeoutError as e:
        raise ExtractionError("Claude API request timed out") from e
    except anthropic.APIError as e:
        raise ExtractionError(f"Claude API error: {e}") from e

    raw = _strip_fences(message.content[0].text)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ExtractionError(
            f"Claude returned non-JSON response: {raw[:200]}"
        ) from e

    try:
        return ExtractedParams(**data)
    except Exception as e:
        raise ExtractionError(f"Response did not match expected schema: {e}") from e
