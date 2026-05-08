/**
 * RF Amplifier Stability Analysis
 * Rollett K-factor, Delta, mu-factor, stability circles
 */

export interface SParam {
  mag_db: number    // magnitude in dB
  phase_deg: number // phase in degrees
}

export interface ComplexNum {
  re: number
  im: number
}

export interface StabilityCircle {
  center: ComplexNum
  radius: number
}

export interface StabilityResult {
  K: number
  delta_mag: number
  mu_source: number      // μ (mu) — modern single criterion
  mu_load: number        // μ' (mu-prime)
  unconditionallyStable: boolean
  potentiallyUnstable: boolean
  inputCircle: StabilityCircle
  outputCircle: StabilityCircle
  // Raw S-params as complex for Smith Chart overlay
  s11: ComplexNum
  s22: ComplexNum
}

// ── Complex arithmetic ────────────────────────────────────────────────────────

export function polar(mag_db: number, phase_deg: number): ComplexNum {
  const mag = Math.pow(10, mag_db / 20)
  const phase_rad = (phase_deg * Math.PI) / 180
  return { re: mag * Math.cos(phase_rad), im: mag * Math.sin(phase_rad) }
}

function add(a: ComplexNum, b: ComplexNum): ComplexNum {
  return { re: a.re + b.re, im: a.im + b.im }
}

function sub(a: ComplexNum, b: ComplexNum): ComplexNum {
  return { re: a.re - b.re, im: a.im - b.im }
}

function mul(a: ComplexNum, b: ComplexNum): ComplexNum {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

function conj(a: ComplexNum): ComplexNum {
  return { re: a.re, im: -a.im }
}

function mag(a: ComplexNum): number {
  return Math.sqrt(a.re ** 2 + a.im ** 2)
}

function mag2(a: ComplexNum): number {
  return a.re ** 2 + a.im ** 2
}

function divC(a: ComplexNum, b: ComplexNum): ComplexNum {
  const denom = mag2(b)
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  }
}

function scale(a: ComplexNum, s: number): ComplexNum {
  return { re: a.re * s, im: a.im * s }
}

// ── Core calculations ─────────────────────────────────────────────────────────

export function analyzeStability(
  s11p: SParam,
  s12p: SParam,
  s21p: SParam,
  s22p: SParam,
): StabilityResult {
  const s11 = polar(s11p.mag_db, s11p.phase_deg)
  const s12 = polar(s12p.mag_db, s12p.phase_deg)
  const s21 = polar(s21p.mag_db, s21p.phase_deg)
  const s22 = polar(s22p.mag_db, s22p.phase_deg)

  // Δ = S11·S22 - S12·S21
  const delta = sub(mul(s11, s22), mul(s12, s21))
  const delta_mag = mag(delta)

  // K = (1 - |S11|² - |S22|² + |Δ|²) / (2·|S12·S21|)
  const s12s21 = mul(s12, s21)
  const K =
    (1 - mag2(s11) - mag2(s22) + delta_mag ** 2) /
    (2 * mag(s12s21))

  // μ (source) = (1 - |S11|²) / (|S22 - Δ·S11*| + |S12·S21|)
  const num_mu_s = 1 - mag2(s11)
  const denom_mu_s = mag(sub(s22, mul(delta, conj(s11)))) + mag(s12s21)
  const mu_source = num_mu_s / denom_mu_s

  // μ' (load) = (1 - |S22|²) / (|S11 - Δ·S22*| + |S12·S21|)
  const num_mu_l = 1 - mag2(s22)
  const denom_mu_l = mag(sub(s11, mul(delta, conj(s22)))) + mag(s12s21)
  const mu_load = num_mu_l / denom_mu_l

  const unconditionallyStable = K > 1 && delta_mag < 1
  const potentiallyUnstable = !unconditionallyStable

  // ── Input stability circle (in Γ_S plane) ──
  // C_s = (S11 - Δ·S22*)* / (|S11|² - |Δ|²)
  const denom_is = mag2(s11) - delta_mag ** 2
  const center_is_num = conj(sub(s11, mul(delta, conj(s22))))
  const inputCircle: StabilityCircle = {
    center: scale(center_is_num, 1 / denom_is),
    radius: Math.abs(mag(s12s21) / denom_is),
  }

  // ── Output stability circle (in Γ_L plane) ──
  // C_L = (S22 - Δ·S11*)* / (|S22|² - |Δ|²)
  const denom_os = mag2(s22) - delta_mag ** 2
  const center_os_num = conj(sub(s22, mul(delta, conj(s11))))
  const outputCircle: StabilityCircle = {
    center: scale(center_os_num, 1 / denom_os),
    radius: Math.abs(mag(s12s21) / denom_os),
  }

  return {
    K: parseFloat(K.toFixed(4)),
    delta_mag: parseFloat(delta_mag.toFixed(4)),
    mu_source: parseFloat(mu_source.toFixed(4)),
    mu_load: parseFloat(mu_load.toFixed(4)),
    unconditionallyStable,
    potentiallyUnstable,
    inputCircle,
    outputCircle,
    s11,
    s22,
  }
}
