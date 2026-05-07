# Spectra — Technical Architecture

**Version:** 1.0
**Date:** 2026-05-07

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React + TS)                      │
│                                                                   │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐  │
│  │  Upload Panel │   │  Block Diagram  │   │  Results Panel   │  │
│  │  (Dropzone)  │   │  (React Flow)   │   │  (Cascade Math)  │  │
│  └──────┬───────┘   └────────┬────────┘   └──────────────────┘  │
│         │                    │                      ▲            │
│         │              Zustand Store                │            │
│         │           (components[], chain[])─────────┘            │
│         │                    │                                    │
└─────────┼────────────────────┼────────────────────────────────────┘
          │ POST /parse-datasheet    POST /calculate-chain
          ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (Python)                      │
│                                                                   │
│  ┌────────────────────────┐   ┌──────────────────────────────┐  │
│  │  /parse-datasheet      │   │  /calculate-chain            │  │
│  │  - Extract PDF bytes   │   │  - Friis NF cascade          │  │
│  │  - Call Claude API     │   │  - Gain cascade              │  │
│  │  - Return JSON params  │   │  - IIP3 cascade              │  │
│  └────────────┬───────────┘   │  - Sensitivity calc          │  │
│               │               └──────────────────────────────┘  │
└───────────────┼─────────────────────────────────────────────────┘
                │ PDF bytes (base64) + prompt
                ▼
        ┌───────────────┐
        │  Anthropic    │
        │  Claude API   │
        │  (claude-     │
        │  sonnet-4-6)  │
        └───────────────┘
```

**Data flow for PDF extraction:**
1. User drops PDF in browser.
2. Frontend sends `multipart/form-data` POST to `/parse-datasheet`.
3. Backend reads PDF bytes, encodes to base64, constructs structured prompt.
4. Claude API returns JSON string with extracted parameters.
5. Backend validates/parses JSON, returns `ComponentParams` to frontend.
6. Frontend shows review panel; engineer confirms or edits.
7. Confirmed component added to Zustand store.

**Data flow for chain calculation:**
1. Any chain mutation (add/remove/reorder/edit) triggers Zustand action.
2. Frontend POSTs current `chain[]` to `/calculate-chain`.
3. Backend runs Friis cascade math, returns `CascadeResult`.
4. Frontend updates Results Panel in < 200ms.

> Note: `/calculate-chain` is a pure function with no side effects. It is stateless — the entire chain is sent with every request. This simplifies the backend to a calculation service with no session concept.

---

## 2. Frontend Component Breakdown

```
src/
├── components/
│   ├── UploadPanel/
│   │   ├── UploadPanel.tsx        # Dropzone + upload state machine
│   │   └── ExtractionReview.tsx   # Editable param review after extraction
│   ├── ChainDiagram/
│   │   ├── ChainDiagram.tsx       # React Flow wrapper
│   │   ├── ComponentNode.tsx      # Custom RF Flow node
│   │   ├── AddNodeButton.tsx      # Edge-level insert control
│   │   └── NodeToolbar.tsx        # Per-node remove/edit controls
│   ├── ResultsPanel/
│   │   ├── ResultsPanel.tsx       # Summary metrics display
│   │   ├── StageTable.tsx         # Per-stage NF/Gain breakdown
│   │   └── SystemParamsForm.tsx   # Bandwidth, temperature inputs
│   ├── ComponentLibrary/
│   │   ├── ComponentLibrary.tsx   # Session-scoped list of saved components
│   │   └── ManualEntryForm.tsx    # Add component without datasheet
│   └── shared/
│       ├── ParameterBadge.tsx     # Reusable Gain/NF/IIP3 display chip
│       └── LoadingSpinner.tsx
├── store/
│   └── useSpectraStore.ts         # Zustand store (single file for MVP)
├── api/
│   ├── parseDatasheet.ts          # POST /parse-datasheet client
│   └── calculateChain.ts          # POST /calculate-chain client
├── types/
│   └── index.ts                   # Shared TypeScript types
└── App.tsx                        # Root layout: sidebar + main canvas
```

### Key React Flow configuration

- **Node type:** `ComponentNode` — custom node rendering component name, type icon, Gain, NF.
- **Edge type:** Default bezier edges; no custom edge logic in MVP.
- **Layout:** Dagre auto-layout (left-to-right) triggered on every chain mutation.
- **Interaction:** `onNodesChange`, `onEdgesChange` handlers sync React Flow state back to Zustand.
- **Drag-to-reorder:** Node drag events update `chain[]` order in Zustand; `useEffect` recalculates on order change.

---

## 3. Backend Module Breakdown

```
backend/
├── main.py                  # FastAPI app, CORS config, router registration
├── routers/
│   ├── datasheet.py         # POST /parse-datasheet endpoint
│   └── chain.py             # POST /calculate-chain endpoint
├── services/
│   ├── pdf_parser.py        # Claude API integration, prompt construction
│   └── cascade.py           # Friis math, sensitivity calculation
├── models/
│   └── schemas.py           # Pydantic request/response models
├── config.py                # Settings (API key from env, CORS origins)
└── tests/
    ├── test_cascade.py      # Unit tests for all cascade formulas
    └── test_pdf_parser.py   # Integration tests with fixture PDFs
```

---

## 4. Data Models

### TypeScript (frontend, `src/types/index.ts`)

```typescript
export interface RFComponent {
  id: string;
  name: string;
  type: ComponentType;
  gain_db: number;
  nf_db: number;
  iip3_dbm: number;
  p1db_dbm: number;
  source: 'datasheet' | 'manual';
}

export type ComponentType =
  | 'LNA'
  | 'Amplifier'
  | 'Attenuator'
  | 'Mixer'
  | 'Filter'
  | 'Generic';

export interface Chain {
  stages: string[];
}

export interface SystemParams {
  bandwidth_hz: number;
  temperature_k: number;
}

export interface CascadeResult {
  total_gain_db: number;
  cascaded_nf_db: number;
  cascaded_iip3_dbm: number;
  sensitivity_dbm: number;
  per_stage: PerStageResult[];
}

export interface PerStageResult {
  stage_index: number;
  component_id: string;
  component_name: string;
  cumulative_gain_db: number;
  cumulative_nf_db: number;
}
```

### Python Pydantic (backend, `backend/models/schemas.py`)

```python
from pydantic import BaseModel
from typing import Literal, List
from enum import Enum

class ComponentType(str, Enum):
    LNA = "LNA"
    AMPLIFIER = "Amplifier"
    ATTENUATOR = "Attenuator"
    MIXER = "Mixer"
    FILTER = "Filter"
    GENERIC = "Generic"

class RFComponent(BaseModel):
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
    stages: List[RFComponent]
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
    per_stage: List[PerStageResult]

class ExtractedParams(BaseModel):
    name: str
    gain_db: float | None
    nf_db: float | None
    iip3_dbm: float | None
    p1db_dbm: float | None
    extraction_notes: str | None
```

---

## 5. API Endpoints

### `POST /parse-datasheet`

**Request:** `multipart/form-data` — `file`: PDF binary

**Response:** `200 OK`
```json
{
  "name": "HMC1002",
  "gain_db": 15.5,
  "nf_db": 0.8,
  "iip3_dbm": -5.0,
  "p1db_dbm": -15.0,
  "extraction_notes": "Gain and NF from Table 1 (typical, 2 GHz). IIP3 from Figure 8."
}
```

**Error responses:** `400` bad PDF, `422` extraction failure, `504` API timeout

---

### `POST /calculate-chain`

**Request:** `application/json`
```json
{
  "stages": [
    { "id": "abc123", "name": "LNA - HMC1002", "type": "LNA",
      "gain_db": 15.5, "nf_db": 0.8, "iip3_dbm": -5.0, "p1db_dbm": -15.0 },
    { "id": "def456", "name": "BPF 2.4 GHz", "type": "Filter",
      "gain_db": -1.5, "nf_db": 1.5, "iip3_dbm": 40.0, "p1db_dbm": 30.0 }
  ],
  "system_params": { "bandwidth_hz": 20000000, "temperature_k": 290 }
}
```

**Response:** `200 OK`
```json
{
  "total_gain_db": 14.0,
  "cascaded_nf_db": 0.94,
  "cascaded_iip3_dbm": -5.18,
  "sensitivity_dbm": -95.1,
  "per_stage": [
    { "stage_index": 0, "component_id": "abc123", "component_name": "LNA - HMC1002",
      "cumulative_gain_db": 15.5, "cumulative_nf_db": 0.8 },
    { "stage_index": 1, "component_id": "def456", "component_name": "BPF 2.4 GHz",
      "cumulative_gain_db": 14.0, "cumulative_nf_db": 0.94 }
  ]
}
```

> This endpoint is a **pure function** — stateless, no side effects. Entire chain is sent with every request.

---

## 6. Friis Cascade Formulas

All calculations operate on linear power ratios, then convert back to dB for output.

### Notation

```
Gᵢ = linear gain of stage i  =  10^(gain_db_i / 10)
Fᵢ = linear noise factor      =  10^(nf_db_i / 10)
IIP3ᵢ = linear IIP3 in mW    =  10^(iip3_dbm_i / 10)
k  = 1.380649e-23 J/K
```

### Cascaded Noise Figure (Friis)

```
F_cascade = F₀ + Σᵢ₌₁ᴺ⁻¹ [ (Fᵢ - 1) / Πⱼ₌₀ⁱ⁻¹ Gⱼ ]

NF_cascade_dB = 10 · log₁₀(F_cascade)
```

### Cascaded Gain

```
G_total_dB = Σᵢ gain_db_i
```

### Cascaded IIP3

```
1 / IIP3_cascade = Σᵢ₌₀ᴺ⁻¹ [ (Πⱼ₌₀ⁱ⁻¹ Gⱼ) / IIP3ᵢ ]   (empty product = 1)

IIP3_cascade_dbm = 10 · log₁₀(IIP3_cascade_mW)
```

### Receiver Sensitivity (MDS)

```
Sensitivity_dBm = 10·log₁₀(k·T·B·1000) + NF_cascade_dB
```

### Python Implementation

```python
import math

k_boltzmann = 1.380649e-23

def db_to_linear(db): return 10 ** (db / 10)
def linear_to_db(x): return 10 * math.log10(x)
def dbm_to_mw(dbm): return 10 ** (dbm / 10)
def mw_to_dbm(mw): return 10 * math.log10(mw)

def cascaded_nf(stages):
    f = db_to_linear(stages[0].nf_db)
    cum_g = db_to_linear(stages[0].gain_db)
    for s in stages[1:]:
        f += (db_to_linear(s.nf_db) - 1) / cum_g
        cum_g *= db_to_linear(s.gain_db)
    return linear_to_db(f)

def cascaded_gain(stages):
    return sum(s.gain_db for s in stages)

def cascaded_iip3(stages):
    inv = 0.0
    cum_g = 1.0
    for s in stages:
        inv += cum_g / dbm_to_mw(s.iip3_dbm)
        cum_g *= db_to_linear(s.gain_db)
    return mw_to_dbm(1.0 / inv)

def receiver_sensitivity(nf_db, bw_hz, temp_k=290.0):
    return 10 * math.log10(k_boltzmann * temp_k * bw_hz) + 30 + nf_db
```

---

## 7. PDF Parsing Strategy — Claude API

### Prompt Design

```python
SYSTEM_PROMPT = """You are an expert RF/microwave engineer and datasheet analyst.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.
If a parameter cannot be found, set its value to null."""

USER_PROMPT = """Extract RF parameters from the attached datasheet PDF.

Return this exact JSON schema:
{
  "name": "<component part number>",
  "gain_db": <typical gain in dB or null>,
  "nf_db": <typical noise figure in dB or null>,
  "iip3_dbm": <typical input IP3 in dBm or null>,
  "p1db_dbm": <typical input P1dB in dBm or null>,
  "extraction_notes": "<where each value was found>"
}

Rules:
- Use TYPICAL values at room temperature (25°C).
- For attenuators/filters, gain is negative.
- If only OIP3 given: IIP3 = OIP3 - Gain.
- If only noise temperature given: NF = 10*log10(1 + T_noise/290).
- Do not invent values. Return null if not present.
"""
```

### API Call

```python
import anthropic, base64, json

def extract_params_from_pdf(pdf_bytes: bytes) -> dict:
    client = anthropic.Anthropic()
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {"type": "document", "source": {
                    "type": "base64", "media_type": "application/pdf", "data": pdf_b64
                }},
                {"type": "text", "text": USER_PROMPT}
            ]
        }]
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
```

---

## 8. State Management (Zustand)

```typescript
interface SpectraStore {
  components: Record<string, RFComponent>;
  addComponent: (component: RFComponent) => void;
  updateComponent: (id: string, updates: Partial<RFComponent>) => void;

  chain: string[];
  addToChain: (componentId: string, atIndex?: number) => void;
  removeFromChain: (index: number) => void;
  reorderChain: (fromIndex: number, toIndex: number) => void;

  systemParams: SystemParams;
  setSystemParams: (params: Partial<SystemParams>) => void;

  cascadeResult: CascadeResult | null;
  setCascadeResult: (result: CascadeResult) => void;

  isExtracting: boolean;
  extractionError: string | null;
  setExtracting: (value: boolean) => void;
  setExtractionError: (error: string | null) => void;
}
```

- `persist` middleware serializes `components` and `chain` to `localStorage` under key `spectra-v1`.
- `cascadeResult` and UI state are excluded from persistence.
- Chain recalculation: `useEffect` in `App.tsx` watches `[chain, components, systemParams]`, debounces 50ms, fires `POST /calculate-chain`.

---

## 9. Folder Structure

```
spectra/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadPanel/
│   │   │   ├── ChainDiagram/
│   │   │   ├── ResultsPanel/
│   │   │   ├── ComponentLibrary/
│   │   │   └── shared/
│   │   ├── store/
│   │   │   └── useSpectraStore.ts
│   │   ├── api/
│   │   │   ├── parseDatasheet.ts
│   │   │   └── calculateChain.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── datasheet.py
│   │   └── chain.py
│   ├── services/
│   │   ├── pdf_parser.py
│   │   └── cascade.py
│   ├── models/
│   │   └── schemas.py
│   ├── config.py
│   ├── tests/
│   │   ├── test_cascade.py
│   │   ├── test_pdf_parser.py
│   │   └── fixtures/
│   ├── requirements.txt
│   └── .env.example
├── docker-compose.yml
├── PRD.md
├── ARCHITECTURE.md
├── TASKS.md
└── README.md
```
