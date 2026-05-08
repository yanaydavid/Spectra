import type { RFComponent } from '../types'

export interface FreqRolloff {
  /** dB/GHz — positive = gain falls with freq, negative = gain rises */
  gain_slope: number
  /** dB/GHz — positive = NF worsens with freq */
  nf_slope: number
  /** dB/GHz — positive = IIP3 worsens with freq */
  iip3_slope: number
}

export const DEFAULT_ROLLOFFS: Record<string, FreqRolloff> = {
  LNA:        { gain_slope:  0.5, nf_slope: 0.08, iip3_slope: 0.3 },
  Amplifier:  { gain_slope:  0.4, nf_slope: 0.10, iip3_slope: 0.2 },
  Attenuator: { gain_slope:  0.0, nf_slope: 0.0,  iip3_slope: 0.0 },
  Filter:     { gain_slope:  0.1, nf_slope: 0.05, iip3_slope: 0.0 },
  Mixer:      { gain_slope:  0.3, nf_slope: 0.15, iip3_slope: 0.4 },
  Generic:    { gain_slope:  0.2, nf_slope: 0.05, iip3_slope: 0.1 },
}

export interface SweepPoint {
  freq_ghz: number
  nf_db: number
  gain_db: number
  iip3_dbm: number
  sensitivity_dbm: number
}

const K_BOLTZMANN = 1.380649e-23

function dbToLinear(db: number) { return Math.pow(10, db / 10) }
function dbmToMw(dbm: number)   { return Math.pow(10, dbm / 10) }
function mwToDbm(mw: number)    { return 10 * Math.log10(mw) }

function friisAt(
  stages: RFComponent[],
  rolloffs: Record<string, FreqRolloff>,
  freq_ghz: number,
  center_ghz: number,
  bandwidth_hz: number,
  temperature_k: number,
): SweepPoint {
  const df = freq_ghz - center_ghz

  const perturbed = stages.map((s) => {
    const r = rolloffs[s.id] ?? DEFAULT_ROLLOFFS[s.type] ?? DEFAULT_ROLLOFFS.Generic
    return {
      ...s,
      gain_db:  s.gain_db  - r.gain_slope  * Math.abs(df),
      nf_db:    Math.max(0, s.nf_db  + r.nf_slope   * Math.abs(df)),
      iip3_dbm: s.iip3_dbm - r.iip3_slope * Math.abs(df),
    }
  })

  // Friis cascade
  let fCascade    = dbToLinear(Math.max(perturbed[0].nf_db, 0))
  let gainLin     = dbToLinear(perturbed[0].gain_db)
  let cumGainDb   = perturbed[0].gain_db
  let invIip3     = 1 / dbmToMw(perturbed[0].iip3_dbm)
  let gainForIip3 = gainLin

  for (let i = 1; i < perturbed.length; i++) {
    const s = perturbed[i]
    fCascade    += (dbToLinear(Math.max(s.nf_db, 0)) - 1) / gainLin
    gainLin     *= dbToLinear(s.gain_db)
    cumGainDb   += s.gain_db
    invIip3     += gainForIip3 / dbmToMw(s.iip3_dbm)
    gainForIip3 *= dbToLinear(s.gain_db)
  }

  const nf_db = 10 * Math.log10(fCascade)
  const noise_floor = 10 * Math.log10(K_BOLTZMANN * temperature_k * bandwidth_hz) + 30

  return {
    freq_ghz,
    nf_db:          parseFloat(nf_db.toFixed(3)),
    gain_db:        parseFloat(cumGainDb.toFixed(3)),
    iip3_dbm:       parseFloat(mwToDbm(1 / invIip3).toFixed(3)),
    sensitivity_dbm: parseFloat((noise_floor + nf_db).toFixed(3)),
  }
}

export function runSweep(
  chain: string[],
  components: Record<string, RFComponent>,
  rolloffs: Record<string, FreqRolloff>,
  f_start: number,
  f_stop: number,
  n_points: number,
  center_ghz: number,
  bandwidth_hz: number,
  temperature_k: number,
): SweepPoint[] {
  const stages = chain.map((id) => components[id]).filter(Boolean)
  if (stages.length === 0) return []

  const step = (f_stop - f_start) / (n_points - 1)
  const points: SweepPoint[] = []

  for (let i = 0; i < n_points; i++) {
    const f = parseFloat((f_start + i * step).toFixed(4))
    points.push(friisAt(stages, rolloffs, f, center_ghz, bandwidth_hz, temperature_k))
  }

  return points
}
