/**
 * Matching Network Synthesis
 * Supports: L-network (2 solutions), π-network, T-network
 * All impedances in Ohms, frequency in GHz, results in nH / pF
 */

export type NetworkType = 'L' | 'pi' | 'T'
export type Topology = 'lowpass' | 'highpass'

export interface Element {
  type: 'L' | 'C'
  value: number   // nH or pF
  unit: 'nH' | 'pF'
  position: 'shunt' | 'series'
  label: string   // e.g. "L1", "C2"
}

export interface MatchingResult {
  networkType: NetworkType
  topology: Topology
  elements: Element[]
  Q: number
  valid: boolean
  error?: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function ω(freq_ghz: number) {
  return 2 * Math.PI * freq_ghz * 1e9
}

function toNH(X: number, freq_ghz: number): Element['value'] {
  return (X / ω(freq_ghz)) * 1e9          // L = X/ω → nH
}

function toPF(X: number, freq_ghz: number): Element['value'] {
  return (1 / (X * ω(freq_ghz))) * 1e12   // C = 1/(X·ω) → pF
}

function fmt(v: number): number {
  return parseFloat(v.toFixed(4))
}

// ── L-network ────────────────────────────────────────────────────────────────

/**
 * Returns two L-network solutions (low-pass and high-pass) for matching Rs → Rl.
 * Rs and Rl must be positive real impedances.
 */
export function synthesisL(
  Rs: number,
  Rl: number,
  freq_ghz: number,
): [MatchingResult, MatchingResult] {
  if (Rs <= 0 || Rl <= 0) {
    const err: MatchingResult = { networkType: 'L', topology: 'lowpass', elements: [], Q: 0, valid: false, error: 'Impedances must be positive' }
    return [err, { ...err }]
  }
  if (Math.abs(Rs - Rl) < 0.01) {
    const err: MatchingResult = { networkType: 'L', topology: 'lowpass', elements: [], Q: 0, valid: false, error: 'Rs ≈ Rl — direct connection or use an attenuator' }
    return [err, { ...err }]
  }

  // High impedance (Rh) on the shunt side, low impedance (Rl_net) on the series side
  const Rh = Math.max(Rs, Rl)
  const Rlo = Math.min(Rs, Rl)
  const Q = Math.sqrt(Rh / Rlo - 1)

  // Shunt is at the Rh side, series is at the Rlo side
  const X_shunt = Rh / Q    // magnitude
  const X_series = Q * Rlo  // magnitude

  // Low-pass: shunt C, series L
  const lp: MatchingResult = {
    networkType: 'L',
    topology: 'lowpass',
    Q: fmt(Q),
    valid: true,
    elements: Rs >= Rl
      ? [
          { type: 'C', value: fmt(toPF(X_shunt, freq_ghz)), unit: 'pF', position: 'shunt',  label: 'C1' },
          { type: 'L', value: fmt(toNH(X_series, freq_ghz)), unit: 'nH', position: 'series', label: 'L1' },
        ]
      : [
          { type: 'L', value: fmt(toNH(X_series, freq_ghz)), unit: 'nH', position: 'series', label: 'L1' },
          { type: 'C', value: fmt(toPF(X_shunt, freq_ghz)), unit: 'pF', position: 'shunt',  label: 'C1' },
        ],
  }

  // High-pass: shunt L, series C
  const hp: MatchingResult = {
    networkType: 'L',
    topology: 'highpass',
    Q: fmt(Q),
    valid: true,
    elements: Rs >= Rl
      ? [
          { type: 'L', value: fmt(toNH(X_shunt, freq_ghz)), unit: 'nH', position: 'shunt',  label: 'L1' },
          { type: 'C', value: fmt(toPF(X_series, freq_ghz)), unit: 'pF', position: 'series', label: 'C1' },
        ]
      : [
          { type: 'C', value: fmt(toPF(X_series, freq_ghz)), unit: 'pF', position: 'series', label: 'C1' },
          { type: 'L', value: fmt(toNH(X_shunt, freq_ghz)), unit: 'nH', position: 'shunt',  label: 'L1' },
        ],
  }

  return [lp, hp]
}

// ── π-network ────────────────────────────────────────────────────────────────

/**
 * π-network: user supplies desired Q (must be > Q_min).
 * Topology: shunt-series-shunt  (C-L-C for low-pass)
 */
export function synthesisPi(
  Rs: number,
  Rl: number,
  freq_ghz: number,
  Q_desired: number,
): MatchingResult {
  const Q_min = Math.sqrt(Math.max(Rs, Rl) / Math.min(Rs, Rl) - 1)

  if (Q_desired <= Q_min) {
    return {
      networkType: 'pi', topology: 'lowpass', elements: [], Q: 0, valid: false,
      error: `Q must be > Q_min = ${Q_min.toFixed(2)}`,
    }
  }

  // Virtual (intermediate) resistance
  const Rv = Math.max(Rs, Rl) / (Q_desired ** 2 + 1)

  // Left L-network: Rs → Rv  (shunt at Rs side)
  const Q_left  = Math.sqrt(Rs / Rv - 1)
  const X_sh_L  = Rs / Q_left      // shunt reactance at source
  const X_se_L  = Q_left * Rv      // series reactance toward virtual R

  // Right L-network: Rl → Rv  (shunt at Rl side, mirror)
  const Q_right = Math.sqrt(Rl / Rv - 1)
  const X_sh_R  = Rl / Q_right
  const X_se_R  = Q_right * Rv

  // For low-pass π: C-L-C
  //   C1 (shunt at source) = 1/(ω·X_sh_L)
  //   L  (series)          = (X_se_L + X_se_R) / ω   (the two series arms merge)
  //   C2 (shunt at load)   = 1/(ω·X_sh_R)
  const X_series_total = X_se_L + X_se_R

  return {
    networkType: 'pi',
    topology: 'lowpass',
    Q: fmt(Q_desired),
    valid: true,
    elements: [
      { type: 'C', value: fmt(toPF(X_sh_L, freq_ghz)), unit: 'pF', position: 'shunt',  label: 'C1' },
      { type: 'L', value: fmt(toNH(X_series_total, freq_ghz)), unit: 'nH', position: 'series', label: 'L1' },
      { type: 'C', value: fmt(toPF(X_sh_R, freq_ghz)), unit: 'pF', position: 'shunt',  label: 'C2' },
    ],
  }
}

// ── T-network ────────────────────────────────────────────────────────────────

/**
 * T-network: user supplies desired Q (must be > Q_min).
 * Topology: series-shunt-series  (L-C-L for low-pass)
 */
export function synthesisT(
  Rs: number,
  Rl: number,
  freq_ghz: number,
  Q_desired: number,
): MatchingResult {
  const Q_min = Math.sqrt(Math.max(Rs, Rl) / Math.min(Rs, Rl) - 1)

  if (Q_desired <= Q_min) {
    return {
      networkType: 'T', topology: 'lowpass', elements: [], Q: 0, valid: false,
      error: `Q must be > Q_min = ${Q_min.toFixed(2)}`,
    }
  }

  // Virtual resistance (higher than both Rs and Rl)
  const Rv = Rs * (Q_desired ** 2 + 1)

  const Q_left  = Q_desired
  const X_se_L  = Q_left * Rs      // series arm at source
  const X_sh    = Rv / Q_left      // shunt arm at virtual R (from left)

  const Q_right = Math.sqrt(Rv / Rl - 1)
  const X_se_R  = Q_right * Rl

  // For low-pass T: L-C-L
  //   L1 (series at source) = X_se_L / ω
  //   C  (shunt)            = 1 / (ω · X_sh)  — left and right shunt merge
  //   L2 (series at load)   = X_se_R / ω
  return {
    networkType: 'T',
    topology: 'lowpass',
    Q: fmt(Q_desired),
    valid: true,
    elements: [
      { type: 'L', value: fmt(toNH(X_se_L, freq_ghz)), unit: 'nH', position: 'series', label: 'L1' },
      { type: 'C', value: fmt(toPF(X_sh, freq_ghz)),   unit: 'pF', position: 'shunt',  label: 'C1' },
      { type: 'L', value: fmt(toNH(X_se_R, freq_ghz)), unit: 'nH', position: 'series', label: 'L2' },
    ],
  }
}

export function qMin(Rs: number, Rl: number): number {
  if (Rs <= 0 || Rl <= 0 || Rs === Rl) return 0
  return parseFloat(Math.sqrt(Math.max(Rs, Rl) / Math.min(Rs, Rl) - 1).toFixed(3))
}
