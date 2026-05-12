/**
 * Touchstone .s2p parser
 * Supports: MA (magnitude-angle), DB (dB-angle), RI (real-imag)
 * Frequency units: Hz, kHz, MHz, GHz
 */

export interface S2PPoint {
  freq_ghz: number
  s11: { mag: number; phase_deg: number }
  s21: { mag: number; phase_deg: number }
  s12: { mag: number; phase_deg: number }
  s22: { mag: number; phase_deg: number }
  /** Derived */
  gain_db: number   // 20·log10(|S21|)
  nf_db?: number    // only if noise data present (future)
}

export interface S2PFile {
  componentName: string
  freqUnit: string
  format: 'MA' | 'DB' | 'RI'
  z0: number
  points: S2PPoint[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toGhz(freq: number, unit: string): number {
  switch (unit.toUpperCase()) {
    case 'HZ':  return freq / 1e9
    case 'KHZ': return freq / 1e6
    case 'MHZ': return freq / 1e3
    case 'GHZ': return freq
    default:    return freq / 1e9
  }
}

function toMagPhase(a: number, b: number, fmt: 'MA' | 'DB' | 'RI'): { mag: number; phase_deg: number } {
  if (fmt === 'MA') return { mag: a, phase_deg: b }
  if (fmt === 'DB') return { mag: Math.pow(10, a / 20), phase_deg: b }
  // RI: real + j·imag
  const mag = Math.sqrt(a ** 2 + b ** 2)
  const phase_deg = Math.atan2(b, a) * (180 / Math.PI)
  return { mag, phase_deg }
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseS2P(text: string, filename = 'component'): S2PFile {
  const lines = text.split('\n').map((l) => l.trim())

  let freqUnit = 'GHZ'
  let format: 'MA' | 'DB' | 'RI' = 'MA'
  let z0 = 50
  const points: S2PPoint[] = []
  let numBuffer: number[] = []

  for (const line of lines) {
    if (!line || line.startsWith('!')) continue

    if (line.startsWith('#')) {
      // Option line: # GHz S MA R 50
      const parts = line.slice(1).trim().toUpperCase().split(/\s+/)
      freqUnit = parts[0] ?? 'GHZ'
      format   = (parts[2] as 'MA' | 'DB' | 'RI') ?? 'MA'
      z0       = parseFloat(parts[4] ?? '50') || 50
      continue
    }

    // Data line — accumulate numbers (may span multiple lines)
    const nums = line.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
    numBuffer.push(...nums)

    // A 2-port record = 9 numbers: freq + 4×(a,b)
    while (numBuffer.length >= 9) {
      const [f, s11a, s11b, s21a, s21b, s12a, s12b, s22a, s22b] = numBuffer.splice(0, 9)
      const freq_ghz = toGhz(f, freqUnit)
      const s21 = toMagPhase(s21a, s21b, format)
      const s11 = toMagPhase(s11a, s11b, format)
      const s12 = toMagPhase(s12a, s12b, format)
      const s22 = toMagPhase(s22a, s22b, format)
      points.push({
        freq_ghz,
        s11, s21, s12, s22,
        gain_db: 20 * Math.log10(Math.max(s21.mag, 1e-12)),
      })
    }
  }

  const name = filename.replace(/\.s2p$/i, '')

  return { componentName: name, freqUnit, format, z0, points }
}

// ── Interpolation ─────────────────────────────────────────────────────────────

/** Linear interpolation of gain_db at a given frequency */
export function interpolateGain(s2p: S2PFile, freq_ghz: number): number | null {
  const pts = s2p.points
  if (pts.length === 0) return null
  if (freq_ghz <= pts[0].freq_ghz) return pts[0].gain_db
  if (freq_ghz >= pts[pts.length - 1].freq_ghz) return pts[pts.length - 1].gain_db

  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].freq_ghz <= freq_ghz && freq_ghz <= pts[i + 1].freq_ghz) {
      const t = (freq_ghz - pts[i].freq_ghz) / (pts[i + 1].freq_ghz - pts[i].freq_ghz)
      return pts[i].gain_db + t * (pts[i + 1].gain_db - pts[i].gain_db)
    }
  }
  return null
}

/** Return S21 magnitude (linear) at a given frequency */
export function interpolateS21Mag(s2p: S2PFile, freq_ghz: number): number {
  const gain = interpolateGain(s2p, freq_ghz)
  return gain !== null ? Math.pow(10, gain / 20) : 1
}
