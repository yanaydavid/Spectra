import type { RFComponent } from '../types'

export interface MonteCarloParams {
  iterations: number
  gain_tol_db: number    // ±dB uniform tolerance on each stage gain
  nf_tol_db: number      // ±dB on each stage NF
  iip3_tol_db: number    // ±dB on each stage IIP3
}

export interface MCResult {
  nf: number[]
  gain: number[]
  iip3: number[]
}

export interface MCStats {
  mean: number
  std: number
  min: number
  max: number
  p5: number    // 5th percentile  (best-case-ish)
  p95: number   // 95th percentile (worst-case-ish)
}

// Box-Muller — not needed here; uniform tolerance is more realistic for component specs
function uniform(range: number): number {
  return (Math.random() * 2 - 1) * range
}

// Inline Friis to avoid async API call — runs entirely in the browser
function dbToLinear(db: number) { return Math.pow(10, db / 10) }
function dbmToMw(dbm: number)  { return Math.pow(10, dbm / 10) }
function mwToDbm(mw: number)   { return 10 * Math.log10(mw) }

function friis(stages: RFComponent[]): { nf: number; gain: number; iip3: number } {
  let fCascade = dbToLinear(Math.max(stages[0].nf_db, 0))
  let gainLin   = dbToLinear(stages[0].gain_db)
  let cumGainDb = stages[0].gain_db
  let invIip3   = 1 / dbmToMw(stages[0].iip3_dbm ?? 30)
  let gainForIip3 = dbToLinear(stages[0].gain_db)

  for (let i = 1; i < stages.length; i++) {
    const s = stages[i]
    fCascade   += (dbToLinear(Math.max(s.nf_db, 0)) - 1) / gainLin
    gainLin    *= dbToLinear(s.gain_db)
    cumGainDb  += s.gain_db
    invIip3    += gainForIip3 / dbmToMw(s.iip3_dbm ?? 30)
    gainForIip3 *= dbToLinear(s.gain_db)
  }

  return {
    nf:   10 * Math.log10(fCascade),
    gain: cumGainDb,
    iip3: mwToDbm(1 / invIip3),
  }
}

export function runMonteCarlo(
  chain: string[],
  components: Record<string, RFComponent>,
  params: MonteCarloParams,
): MCResult {
  const stages = chain.map((id) => components[id]).filter(Boolean)
  if (stages.length === 0) return { nf: [], gain: [], iip3: [] }

  const nfs: number[] = []
  const gains: number[] = []
  const iip3s: number[] = []

  for (let i = 0; i < params.iterations; i++) {
    const perturbed = stages.map((s) => ({
      ...s,
      gain_db: s.gain_db + uniform(params.gain_tol_db),
      nf_db:   Math.max(0, s.nf_db + uniform(params.nf_tol_db)),
      iip3_dbm: (s.iip3_dbm ?? 30) + uniform(params.iip3_tol_db),
    }))
    const r = friis(perturbed)
    nfs.push(r.nf)
    gains.push(r.gain)
    iip3s.push(r.iip3)
  }

  return { nf: nfs, gain: gains, iip3: iip3s }
}

export function computeStats(values: number[]): MCStats {
  if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, p5: 0, p95: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n

  const pct = (p: number) => sorted[Math.floor(p * (n - 1))]

  return {
    mean: parseFloat(mean.toFixed(3)),
    std:  parseFloat(Math.sqrt(variance).toFixed(3)),
    min:  parseFloat(sorted[0].toFixed(3)),
    max:  parseFloat(sorted[n - 1].toFixed(3)),
    p5:   parseFloat(pct(0.05).toFixed(3)),
    p95:  parseFloat(pct(0.95).toFixed(3)),
  }
}

export function buildHistogram(values: number[], bins = 30): { x: number; count: number }[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.01
  const binW = range / bins

  const counts = Array(bins).fill(0)
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binW), bins - 1)
    counts[idx]++
  }

  return counts.map((count, i) => ({
    x: parseFloat((min + (i + 0.5) * binW).toFixed(3)),
    count,
  }))
}
