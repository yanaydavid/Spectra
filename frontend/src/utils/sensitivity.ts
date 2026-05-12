/**
 * Sensitivity Analysis
 *
 * For each stage i and each parameter p ∈ {gain_db, nf_db, iip3_dbm}:
 *   sensitivity[i][p] = (cascade_metric(base + ε) − cascade_metric(base)) / ε
 *
 * Returns the "bang-for-buck" coefficient — how many dB of cascade metric
 * improvement you get per 1 dB improvement in a single stage parameter.
 *
 * Also supports "what-if" deltas: apply user-specified Δ values and recompute
 * the cascade, returning the modified metrics alongside the delta vs baseline.
 */

import type { RFComponent } from '../types'

// ── Friis (same as autoBuilder — kept local to avoid circular imports) ─────────

function db2lin(db: number)  { return Math.pow(10, db / 10) }
function dbm2mw(dbm: number) { return Math.pow(10, dbm / 10) }
function mw2dbm(mw: number)  { return 10 * Math.log10(mw < 1e-30 ? 1e-30 : mw) }

function cascadeMetrics(stages: RFComponent[]): {
  nf_db: number; gain_db: number; iip3_dbm: number
} {
  if (stages.length === 0) return { nf_db: 0, gain_db: 0, iip3_dbm: 100 }
  let fC      = db2lin(Math.max(stages[0].nf_db, 0))
  let gLin    = db2lin(stages[0].gain_db)
  let cumGain = stages[0].gain_db
  let invIip3 = stages[0].iip3_dbm != null ? 1 / dbm2mw(stages[0].iip3_dbm) : 0
  let gIip3   = gLin

  for (let i = 1; i < stages.length; i++) {
    const s = stages[i]
    fC      += (db2lin(Math.max(s.nf_db, 0)) - 1) / gLin
    gLin    *= db2lin(s.gain_db)
    cumGain += s.gain_db
    if (s.iip3_dbm != null) invIip3 += gIip3 / dbm2mw(s.iip3_dbm)
    gIip3   *= db2lin(s.gain_db)
  }

  return {
    nf_db:    10 * Math.log10(Math.max(fC, 1)),
    gain_db:  cumGain,
    iip3_dbm: invIip3 > 0 ? mw2dbm(1 / invIip3) : 100,
  }
}

// ── types ─────────────────────────────────────────────────────────────────────

export interface StageSensitivity {
  stageIndex: number
  componentId: string
  componentName: string
  /** dNF_cascade per 1 dB improvement in stage NF (should be ≤ 1, positive = good) */
  nfLeverage: number
  /** dGain_cascade per 1 dB change in stage gain (should be ≈ 1) */
  gainLeverage: number
  /** dIIP3_cascade per 1 dBm improvement in stage IIP3 */
  iip3Leverage: number
}

export interface WhatIfResult {
  nf_db:    number
  gain_db:  number
  iip3_dbm: number
  deltaNf:   number   // vs baseline (negative = improved)
  deltaGain: number
  deltaIip3: number
}

export type ParamDelta = {
  gain_db:  number
  nf_db:    number
  iip3_dbm: number
}

// ── sensitivity coefficients ─────────────────────────────────────────────────

const EPS = 0.1   // finite-difference step in dB

export function computeSensitivity(
  chain: string[],
  components: Record<string, RFComponent>,
): StageSensitivity[] {
  const stages = chain.map((id) => components[id]).filter(Boolean)
  if (stages.length === 0) return []

  const base = cascadeMetrics(stages)

  return stages.map((s, i) => {
    const perturb = (param: keyof RFComponent, delta: number) => {
      const copy = stages.map((st, j) =>
        j === i ? { ...st, [param]: (st[param] as number) + delta } : st
      )
      return cascadeMetrics(copy)
    }

    // NF leverage: improve stage NF by EPS → how much does cascade NF improve?
    const nfUp   = perturb('nf_db', -EPS)   // lower NF = improvement
    const nfLev  = (base.nf_db - nfUp.nf_db) / EPS   // positive = good leverage

    // Gain leverage: increase gain by EPS
    const gainUp  = perturb('gain_db', EPS)
    const gainLev = (gainUp.gain_db - base.gain_db) / EPS   // should be ~1

    // IIP3 leverage: improve IIP3 by EPS
    const iip3Up  = perturb('iip3_dbm', EPS)
    const iip3Lev = (iip3Up.iip3_dbm - base.iip3_dbm) / EPS

    return {
      stageIndex:    i,
      componentId:   s.id,
      componentName: s.name,
      nfLeverage:    parseFloat(nfLev.toFixed(3)),
      gainLeverage:  parseFloat(gainLev.toFixed(3)),
      iip3Leverage:  parseFloat(iip3Lev.toFixed(3)),
    }
  })
}

// ── what-if calculation ───────────────────────────────────────────────────────

export function computeWhatIf(
  chain: string[],
  components: Record<string, RFComponent>,
  deltas: Record<string, ParamDelta>,   // keyed by component id
): WhatIfResult {
  const stages = chain.map((id) => components[id]).filter(Boolean)
  const base   = cascadeMetrics(stages)

  const modified = stages.map((s) => {
    const d = deltas[s.id]
    if (!d) return s
    return {
      ...s,
      gain_db:  s.gain_db  + (d.gain_db  ?? 0),
      nf_db:    s.nf_db    + (d.nf_db    ?? 0),
      iip3_dbm: s.iip3_dbm != null ? s.iip3_dbm + (d.iip3_dbm ?? 0) : s.iip3_dbm,
    }
  })
  const m = cascadeMetrics(modified)

  return {
    nf_db:    parseFloat(m.nf_db.toFixed(2)),
    gain_db:  parseFloat(m.gain_db.toFixed(2)),
    iip3_dbm: parseFloat(m.iip3_dbm.toFixed(2)),
    deltaNf:   parseFloat((m.nf_db   - base.nf_db).toFixed(2)),
    deltaGain: parseFloat((m.gain_db  - base.gain_db).toFixed(2)),
    deltaIip3: parseFloat((m.iip3_dbm - base.iip3_dbm).toFixed(2)),
  }
}
