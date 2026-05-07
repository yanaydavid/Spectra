# Spectra — Development Task List

**Version:** 1.0
**Date:** 2026-05-07

Tasks are ordered to build the smallest working slice first, then expand.
Complexity: **S** = < 2h, **M** = 2–6h, **L** = 6–12h.

---

## Group 1: Backend — Cascade Calculation Engine

Build and fully test the math engine before touching anything else. No external dependencies.

### TASK-001 — Backend scaffold and dependency setup · S
Initialize `backend/`. Create `requirements.txt`: `fastapi`, `uvicorn[standard]`, `pydantic`, `anthropic`, `python-multipart`, `pytest`, `httpx`. Create `main.py` with bare FastAPI app and `GET /health` → `{"status": "ok"}`. Verify `uvicorn main:app --reload` starts.

### TASK-002 — Pydantic data models · S
Implement all models in `backend/models/schemas.py`: `RFComponent`, `ComponentType`, `SystemParams`, `ChainCalculationRequest`, `PerStageResult`, `CascadeResult`, `ExtractedParams`. Add `model_config = ConfigDict(use_enum_values=True)`.

### TASK-003 — Friis cascade: NF and Gain · M
Implement `backend/services/cascade.py`:
- `db_to_linear`, `linear_to_db`, `dbm_to_mw`, `mw_to_dbm`
- `cascaded_nf(stages) -> float` — cascaded NF in dB
- `cascaded_gain(stages) -> float` — total gain in dB
- `per_stage_cumulative(stages) -> list[PerStageResult]`
Handle single-stage and raise `ValueError` on empty chain.

### TASK-004 — Cascaded IIP3 and receiver sensitivity · M
Add to `cascade.py`:
- `cascaded_iip3(stages) -> float` — input IIP3 in dBm
- `receiver_sensitivity(nf_db, bw_hz, temp_k) -> float` — MDS in dBm
Handle zero/near-zero linear IIP3 without divide-by-zero.

### TASK-005 — Cascade unit tests · M
Write `backend/tests/test_cascade.py`. Required test cases:
1. Two-stage LNA + amplifier — hand-calculated reference values, assert within ±0.01 dB.
2. Single stage — NF out = NF in; IIP3 out = IIP3 in.
3. High-gain first stage dominance — 30 dB LNA makes 2nd stage negligible.
4. Attenuator first — negative gain, NF = loss (passive Friis: F = 1/G).
5. Sensitivity — verify at 290K, 1 MHz BW ≈ −114 dBm + NF.
6. Empty chain — `ValueError` raised.
All must pass before TASK-006.

### TASK-006 — `/calculate-chain` endpoint · S
Implement `backend/routers/chain.py` with `POST /calculate-chain`. Accept `ChainCalculationRequest`, call cascade service, return `CascadeResult`. Register router in `main.py`. Test with `curl`.

---

## Group 2: Backend — PDF Parsing Service

Depends on: TASK-001.

### TASK-007 — Claude API config · S
Implement `backend/config.py` with `pydantic-settings` loading `ANTHROPIC_API_KEY` from env. Create `.env.example`. Verify `anthropic.Anthropic()` instantiates with key.

### TASK-008 — PDF parser service · M
Implement `backend/services/pdf_parser.py`. Function `extract_params_from_pdf(pdf_bytes: bytes) -> ExtractedParams`:
1. Base64-encode PDF.
2. Construct system + user prompts per ARCHITECTURE.md Section 7.
3. Call Claude API with `claude-sonnet-4-6`, document content block + text prompt.
4. Parse response JSON, strip markdown fences if present.
5. Validate against `ExtractedParams`. Raise `ExtractionError` on JSON parse failure.

### TASK-009 — `/parse-datasheet` endpoint · M
Implement `backend/routers/datasheet.py` with `POST /parse-datasheet`. Accept `multipart/form-data`, validate PDF content-type, call `pdf_parser.extract_params_from_pdf`. Handle all error cases (auth, timeout, parse failure) with correct HTTP codes. Register in `main.py`.

### TASK-010 — PDF integration tests · M
Add `backend/tests/fixtures/` with 2–3 real RF datasheets. Write `backend/tests/test_pdf_parser.py` with `@pytest.mark.integration` tests. Assert extracted values within 10% of manually verified ground truth. Test malformed PDF raises `ExtractionError`.

---

## Group 3: Frontend — Foundation

### TASK-011 — Frontend scaffold · S
`npm create vite@latest frontend -- --template react-ts`. Install: `@xyflow/react`, `zustand`, `tailwindcss`, `@tailwindcss/vite`, `axios`. Configure Tailwind. Add Vite proxy: `/api` → `http://localhost:8000`.

### TASK-012 — TypeScript types · S
Implement `frontend/src/types/index.ts` with all types from ARCHITECTURE.md Section 4. Must exactly mirror backend Pydantic schemas.

### TASK-013 — Zustand store · M
Implement `frontend/src/store/useSpectraStore.ts` with full store interface from ARCHITECTURE.md Section 8. Use `persist` middleware for `components` and `chain` under key `spectra-v1`. Exclude `cascadeResult` and UI state from persistence.

### TASK-014 — API clients · S
Implement `frontend/src/api/parseDatasheet.ts` and `calculateChain.ts` using `axios`. `parseDatasheet` sends `FormData`. `calculateChain` sends `ChainCalculationRequest` JSON. Both return typed responses and throw typed errors.

### TASK-015 — App shell layout · M
Implement `App.tsx`: left sidebar (320px), main canvas, right results panel. Add `useEffect` watching `[chain, components, systemParams]`, debounced 50ms, calling `calculateChain` and dispatching `setCascadeResult`.

---

## Group 4: Frontend — Chain Diagram

Depends on: TASK-011–015.

### TASK-016 — ComponentNode custom node · M
`frontend/src/components/ChainDiagram/ComponentNode.tsx`. Display: name, type label, Gain badge (green/red), NF badge (orange), left/right handles. Hover reveals remove button (×) top-right.

### TASK-017 — ChainDiagram wrapper · L
`ChainDiagram.tsx`. Read `chain` + `components` from Zustand. Convert to React Flow `nodes[]`/`edges[]`. Left-to-right horizontal layout (evenly spaced). Register `ComponentNode`. Wire `onNodesChange` to update chain order in Zustand on drag.

### TASK-018 — Add/remove chain controls · M
`AddNodeButton.tsx`: "+" button on each edge and after last node. Click opens dropdown of library components. Selecting calls `addToChain(id, atIndex)`. Remove button in `ComponentNode` calls `removeFromChain(index)`.

---

## Group 5: Frontend — Upload and Results

### TASK-019 — Upload panel + extraction review · L
`UploadPanel.tsx`: drag-and-drop zone (native HTML5). On drop, call `parseDatasheet`, set `isExtracting`. On success, show `ExtractionReview.tsx`: editable inputs for all four params, name field, "Add to Library" / "Cancel". Show `extraction_notes` as muted info line.

### TASK-020 — Manual component entry · M
`ManualEntryForm.tsx`: collapsible form. Fields: Name, Type (select), Gain, NF, IIP3, P1dB. Submit calls `addComponent` with generated UUID and `source: 'manual'`. All numeric fields required and parseable as float.

### TASK-021 — Component library list · S
`ComponentLibrary.tsx`: scrollable list of `components` from Zustand. Each item: name, type badge, Gain/NF. "Add to Chain" button calls `addToChain(id)`. Source indicator: "PDF" or "manual".

### TASK-022 — Results panel · M
`ResultsPanel.tsx`: four metric cards (Cascaded NF, Total Gain, Cascaded IIP3, Sensitivity). `StageTable.tsx`: Stage #, Component, Cumulative Gain, Cumulative NF. `SystemParamsForm.tsx`: Bandwidth (MHz → stored as Hz), Temperature (K). Show "—" when `cascadeResult` is null.

---

## Group 6: Integration and Polish

### TASK-023 — End-to-end manual test · S
Full flow: start backend + frontend → upload real datasheet PDF → verify extraction → add to library → add to chain → add second manual component → verify cascade results → reorder → verify update → reload browser → verify localStorage persistence. Document any issues.

### TASK-024 — CORS configuration · S
Configure `CORSMiddleware` in `main.py`. Dev: allow `http://localhost:5173`. Prod: read `ALLOWED_ORIGINS` from env.

### TASK-025 — Error states and loading UI · M
Audit all error/loading states:
- UploadPanel: spinner during extraction, error banner with retry.
- ChainDiagram: empty state ("Add a component to get started").
- ResultsPanel: "— dB" placeholders on empty chain.
- `/calculate-chain` error: small error indicator without clearing existing results.

### TASK-026 — Input validation hardening · M
Backend: clamp negative `nf_db` to 0 with warning; log `gain_db` outside ±60 dB; return `422` on `bandwidth_hz <= 0` or `temperature_k <= 0`.
Frontend: chain entries use unique chain-entry UUIDs (distinct from library component IDs) to allow same component multiple times.

### TASK-027 — Docker Compose · S
`docker-compose.yml` with `backend` (Python 3.12-slim, port 8000, reads `.env`) and `frontend` (node:20-alpine, port 5173). Add `depends_on`. Document startup in README.

---

## Task Summary

| Task | Title | Complexity | Depends on |
|---|---|---|---|
| 001 | Backend scaffold | S | — |
| 002 | Pydantic models | S | 001 |
| 003 | Friis NF + Gain | M | 002 |
| 004 | IIP3 + Sensitivity | M | 003 |
| 005 | Cascade unit tests | M | 003, 004 |
| 006 | /calculate-chain | S | 005 |
| 007 | Claude API config | S | 001 |
| 008 | PDF parser service | M | 007 |
| 009 | /parse-datasheet | M | 008 |
| 010 | PDF integration tests | M | 009 |
| 011 | Frontend scaffold | S | — |
| 012 | TS types | S | 011 |
| 013 | Zustand store | M | 012 |
| 014 | API clients | S | 013 |
| 015 | App shell | M | 013, 014 |
| 016 | ComponentNode | M | 015 |
| 017 | ChainDiagram | L | 016 |
| 018 | Add/remove controls | M | 017 |
| 019 | Upload + review | L | 014, 015 |
| 020 | Manual entry form | M | 013 |
| 021 | Component library | S | 013 |
| 022 | Results panel | M | 013, 015 |
| 023 | E2E manual test | S | 006, 009, 022 |
| 024 | CORS config | S | 006, 009 |
| 025 | Error/loading states | M | 019, 022 |
| 026 | Validation hardening | M | 006, 013 |
| 027 | Docker Compose | S | all |

**Recommended build order:**
001 → 002 → 003 → 004 → 005 → 006 *(backend calc engine done)*
→ 007 → 008 → 009 → 010 *(PDF pipeline done)*
→ 011 → 012 → 013 → 014 → 015 → 021 → 020 → 022 → 016 → 017 → 018 → 019 *(full UI done)*
→ 023 → 024 → 025 → 026 → 027
