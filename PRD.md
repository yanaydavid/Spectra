# Spectra — Product Requirements Document

**Version:** 1.0
**Status:** Draft
**Date:** 2026-05-07

---

## 1. Problem Statement

RF and microwave engineers spend a disproportionate fraction of their time on mechanical, low-cognition work:

- **Chain calculations by hand or in Excel.** Friis cascade equations are well-defined, yet engineers still build fragile spreadsheets that break when a component is swapped.
- **Manual datasheet parsing.** Extracting Gain, NF, IIP3, and P1dB from a vendor PDF involves hunting through tables, footnotes, and plots — often taking 10–30 minutes per component.
- **No fast iteration loop.** Changing one component in a receive chain requires re-running all cascade math manually, discouraging exploratory design.

The result: engineers with deep RF expertise spend the majority of their design time on arithmetic and document search rather than architectural judgment.

Spectra eliminates this mechanical overhead. Phase 1 focuses on the two highest-leverage automations: datasheet parameter extraction and real-time chain cascade calculation.

---

## 2. Target Users and Personas

### Primary Persona — Staff RF Systems Engineer

| Attribute | Detail |
|---|---|
| Role | RF/microwave systems or hardware engineer |
| Experience | 5–20 years; comfortable with Friis, S-parameters, link budgets |
| Environment | Defense, telecom, satellite, test & measurement |
| Tools today | Excel/Sheets for cascade math, Keysight ADS for detailed simulation |
| Pain | ADS is overkill for early-stage chain scoping; Excel is brittle |
| Goal | Quickly evaluate "does this chain work?" before committing to layout |

### Secondary Persona — RF Application Engineer

| Attribute | Detail |
|---|---|
| Role | FAE or applications engineer at a component vendor |
| Use case | Demo chain performance using own vendor's parts |
| Pain | Building customer demos in Excel is slow and unprofessional |
| Goal | Interactive chain demo that updates in real time |

### Out-of-scope personas (for MVP)

- Students learning RF fundamentals (different UX needs; lower data quality tolerance)
- Antenna/EMC engineers (different parameter sets)
- Non-RF hardware engineers

---

## 3. MVP Goals

### Phase 1 Objective

Deliver a working, self-contained web tool that lets an RF engineer:

1. Upload a component datasheet PDF and get back structured RF parameters automatically.
2. Build an RF chain by assembling components into an ordered block diagram.
3. See cascade results (Total NF, Total Gain, system IIP3, receiver sensitivity) update in real time as the chain changes.

### Success Metrics

| Metric | Target | Measurement method |
|---|---|---|
| Datasheet extraction accuracy | ≥ 90% of Gain/NF/IIP3/P1dB fields correct on a test set of 20 vendor datasheets | Manual audit of extracted values vs. datasheet ground truth |
| Chain calculation correctness | 100% match to reference implementation (hand-calculated Friis) | Unit test suite |
| Time-to-first-chain | Engineer can build a 5-component chain in < 3 minutes from first load | Timed usability session |
| Extraction latency | PDF parsed and parameters returned in < 15 seconds | Backend timing logs |
| Calculation latency | Chain results update in < 200ms after any component change | Frontend timing |

---

## 4. User Stories

### Datasheet Import

- As an RF engineer, I want to upload a vendor PDF datasheet so that I do not have to manually find and copy parameter values.
- As an RF engineer, I want the system to extract Gain, NF, IIP3, and P1dB from the datasheet so that I can immediately use the component in a chain.
- As an RF engineer, I want to review extracted parameters before adding the component to my chain so that I can catch any extraction errors.
- As an RF engineer, I want to manually override any extracted parameter so that I can correct errors or use a different operating condition.

### Chain Builder

- As an RF engineer, I want to see my RF chain as an interactive block diagram so that I can visually verify signal flow.
- As an RF engineer, I want to drag components to reorder them in the chain so that I can explore different topologies quickly.
- As an RF engineer, I want to add a component between two existing components so that I can insert an attenuator or filter without rebuilding the chain.
- As an RF engineer, I want to remove a component from the chain so that I can evaluate the impact of removing an amplifier stage.
- As an RF engineer, I want to add a manual component (name + parameters, no datasheet) so that I can include idealized or placeholder blocks.

### Cascade Results

- As an RF engineer, I want to see total cascaded NF, total gain, cascaded IIP3, and receiver sensitivity displayed prominently so that I can assess system performance at a glance.
- As an RF engineer, I want results to update immediately when I change any component or reorder the chain so that exploration feels interactive, not batch.
- As an RF engineer, I want to see per-stage gain and NF contributions so that I can identify which component dominates the noise budget.
- As an RF engineer, I want to set a system bandwidth and reference temperature so that the sensitivity calculation is accurate for my application.

### General

- As an RF engineer, I want the tool to work without creating an account or logging in so that I can try it immediately.
- As an RF engineer, I want my chain state to persist in the browser so that a page refresh does not lose my work.

---

## 5. Feature List — Phase 1 (MVP)

### F-01: PDF Datasheet Upload

- Accepts single PDF file via drag-and-drop or file picker.
- File size limit: 20 MB.
- Supported format: PDF only (no DOCX, HTML, images in MVP).

### F-02: AI Parameter Extraction

- Sends PDF to backend for parsing via Claude API.
- Extracts per-component: Gain (dB), Noise Figure (dB), IIP3 (dBm), P1dB (dBm).
- Returns structured JSON with extracted values and confidence flags.
- Extraction latency target: < 15 seconds.

### F-03: Parameter Review and Override

- After extraction, displays a review panel showing extracted values.
- Engineer can edit any field before confirming.
- Component name defaults to datasheet filename; editable.

### F-04: Component Library (Session-Scoped)

- Stores all confirmed components in memory for the session.
- Engineer can add the same component to the chain multiple times.
- No persistence across browser sessions in MVP.

### F-05: Interactive Block Diagram (React Flow)

- Renders chain as a left-to-right node graph.
- Each node shows: component name, type icon (LNA, Mixer, Attenuator, Filter, Amplifier), Gain, NF.
- Nodes are reorderable via drag-and-drop.
- Add/remove node controls on each node and between nodes.

### F-06: Cascade Calculator

- Implements Friis cascade formulas for NF and Gain.
- Implements cascaded IIP3 formula.
- Computes receiver sensitivity given bandwidth and temperature inputs.
- Recalculates on every chain mutation (add, remove, reorder, parameter edit).

### F-07: Results Panel

- Displays: Cascaded NF (dB), Total Gain (dB), Cascaded IIP3 (dBm), Receiver Sensitivity (dBm).
- Per-stage table: stage index, component name, cumulative NF, cumulative gain.
- System parameters input: Bandwidth (Hz), Reference Temperature (K, default 290 K).

### F-08: Manual Component Entry

- Form to add a component by entering name and parameters directly (no datasheet required).
- Useful for idealized blocks or components with known specs.

---

## 6. Out of Scope for MVP

| Item | Reason deferred |
|---|---|
| User accounts / authentication | No database in MVP; adds no value for single-session tool |
| Persistent storage / saved chains | Adds backend complexity; localStorage sufficient for MVP signal |
| Schematic generation (Phase 2) | Separate problem domain; do not block Phase 1 |
| PCB layout assistance (Phase 3) | Requires EDA integration; entirely separate capability |
| Multi-port / S-parameter import (Touchstone .s2p) | Valuable but out of MVP scope |
| Noise temperature / Y-factor calculations | Niche; Phase 2 candidate |
| Mixer image / spurious analysis | Out of MVP scope |
| Export to CSV, PDF report | Phase 2 |
| Collaborative / multi-user editing | No database; Phase 3+ |
| Mobile layout | Desktop-first tool; RF engineers work at workstations |
| Non-PDF datasheet formats | Phase 2 |

---

## 7. Phase 2 and Phase 3 — Brief Overview

### Phase 2: Auto-Schematic Generation

Given a completed RF chain definition, automatically produce a standard RF schematic (symbol-level, not PCB). Output targets: SVG and potentially a netlist format compatible with KiCad or LTspice. This phase requires a symbol library and a layout routing engine.

### Phase 3: Layout Assistance

Given the schematic, assist with PCB placement and routing constraints specific to RF (microstrip impedance, via stitching rules, keepout zones, transmission line length matching). Likely requires integration with an EDA tool API or a custom layout constraint engine.

---

## 8. Constraints and Assumptions

- **No database for MVP.** All state lives in browser memory (Zustand store) and Python process memory. Chains are not persisted server-side.
- **Claude API availability.** PDF parsing depends on Anthropic Claude API. Downtime or quota limits will degrade the datasheet import feature. A fallback manual entry flow (F-08) mitigates this.
- **Single-user, single-session.** No concurrency handling required in MVP.
- **Desktop browser only.** Chrome and Firefox latest two major versions.
- **Datasheets are in English.** Multi-language support is out of scope.
