"""
AI Design Assistant — /ai-assist
Accepts the current chain state + user message, calls Claude with full RF context,
streams the response back as Server-Sent Events.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import anthropic

from config import settings

router = APIRouter()

# ── request schema ────────────────────────────────────────────────────────────

class StageInfo(BaseModel):
    name: str
    type: str
    gain_db: float
    nf_db: float
    iip3_dbm: Optional[float] = None

class CascadeInfo(BaseModel):
    cascaded_nf_db: float
    total_gain_db: float
    cascaded_iip3_dbm: Optional[float] = None
    sensitivity_dbm: float

class SystemParamsInfo(BaseModel):
    bandwidth_hz: float = 20_000_000
    temperature_k: float = 290.0
    frequency_ghz: float = 2.4

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class AIAssistRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    stages: list[StageInfo] = []
    cascade: Optional[CascadeInfo] = None
    system_params: Optional[SystemParamsInfo] = None

# ── system prompt builder ─────────────────────────────────────────────────────

def build_system_prompt(req: AIAssistRequest) -> str:
    chain_desc = ""
    if req.stages:
        lines = []
        for i, s in enumerate(req.stages):
            iip3 = f", IIP3 {s.iip3_dbm:.1f} dBm" if s.iip3_dbm is not None else ""
            lines.append(f"  Stage {i+1}: {s.name} ({s.type}) — Gain {s.gain_db:.1f} dB, NF {s.nf_db:.1f} dB{iip3}")
        chain_desc = "Current RF chain:\n" + "\n".join(lines)
    else:
        chain_desc = "No chain loaded yet."

    cascade_desc = ""
    if req.cascade:
        c = req.cascade
        iip3_str = f"{c.cascaded_iip3_dbm:.2f} dBm" if c.cascaded_iip3_dbm is not None else "N/A"
        cascade_desc = (
            f"\nCascade results:\n"
            f"  Cascaded NF: {c.cascaded_nf_db:.2f} dB\n"
            f"  Total Gain:  {c.total_gain_db:.2f} dB\n"
            f"  Cascaded IIP3: {iip3_str}\n"
            f"  Sensitivity (MDS): {c.sensitivity_dbm:.2f} dBm"
        )

    sysparams_desc = ""
    if req.system_params:
        p = req.system_params
        bw_mhz = p.bandwidth_hz / 1e6
        sysparams_desc = (
            f"\nSystem parameters:\n"
            f"  Frequency: {p.frequency_ghz:.3f} GHz\n"
            f"  Bandwidth: {bw_mhz:.1f} MHz\n"
            f"  Temperature: {p.temperature_k:.0f} K"
        )

    return f"""You are an expert RF systems engineer and design assistant embedded in Spectra, a professional RF cascade analysis tool.

You help engineers design, analyse and optimise RF receiver and transmitter chains using Friis cascade theory, noise figure analysis, linearity (IIP3/P1dB), dynamic range (SFDR, IDR, BDR), matching networks, and stability analysis.

{chain_desc}{cascade_desc}{sysparams_desc}

Guidelines:
- Be concise and technical. Use dB, dBm, GHz naturally.
- Reference the actual chain data above when giving advice.
- If the chain has a high NF, suggest which stage to improve first (Friis says the first stage dominates).
- If asked for component suggestions, recommend real-world parts (Mini-Circuits, Qorvo, Skyworks, etc.).
- Format numbers clearly. Use bullet points for lists.
- If the question is unrelated to RF engineering, politely redirect.
- Keep responses focused — under 300 words unless the user asks for detail."""

# ── endpoint (non-streaming — avoids proxy buffering issues) ─────────────────

class AIAssistResponse(BaseModel):
    reply: str

@router.post("/ai-assist", response_model=AIAssistResponse)
async def ai_assist(req: AIAssistRequest):
    if not settings.anthropic_api_key:
        return AIAssistResponse(reply="Error: ANTHROPIC_API_KEY not configured on server.")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    messages = []
    for msg in req.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    system_prompt = build_system_prompt(req)

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=600,
            system=system_prompt,
            messages=messages,
        )
        reply = response.content[0].text
    except Exception as e:
        reply = f"Error from AI: {str(e)}"

    return AIAssistResponse(reply=reply)
