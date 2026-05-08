import { useState, useMemo } from 'react'
import { analyzeStability, type SParam } from '../../utils/stability'
import { SmithChart } from './SmithChart'

// ── Preset S-params for common components ─────────────────────────────────────
const PRESETS: Record<string, { label: string; s11: SParam; s12: SParam; s21: SParam; s22: SParam }> = {
  lna_stable: {
    label: 'LNA (stable)',
    s11: { mag_db: -12, phase_deg: -80 },
    s12: { mag_db: -25, phase_deg:  60 },
    s21: { mag_db:  18, phase_deg: 100 },
    s22: { mag_db: -15, phase_deg: -70 },
  },
  lna_marginal: {
    label: 'LNA (marginal)',
    s11: { mag_db:  -6, phase_deg: -100 },
    s12: { mag_db: -18, phase_deg:   45 },
    s21: { mag_db:  22, phase_deg: 120  },
    s22: { mag_db:  -8, phase_deg:  -60 },
  },
  pa_unstable: {
    label: 'PA (potentially unstable)',
    s11: { mag_db:  -4, phase_deg: -140 },
    s12: { mag_db: -10, phase_deg:   30 },
    s21: { mag_db:  25, phase_deg:  140 },
    s22: { mag_db:  -5, phase_deg: -130 },
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SParamInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: SParam
  onChange: (v: SParam) => void
}) {
  return (
    <div className="bg-gray-900 rounded p-2 space-y-1">
      <p className="text-[10px] font-semibold text-gray-400">{label}</p>
      <div className="flex gap-1">
        <div className="flex-1">
          <label className="text-[9px] text-gray-600">Mag (dB)</label>
          <input
            type="number"
            step="0.5"
            value={value.mag_db}
            onChange={(e) => onChange({ ...value, mag_db: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
          />
        </div>
        <div className="flex-1">
          <label className="text-[9px] text-gray-600">Phase (°)</label>
          <input
            type="number"
            step="5"
            value={value.phase_deg}
            onChange={(e) => onChange({ ...value, phase_deg: Number(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
          />
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value, good, bad, fmt = (v: number) => v.toFixed(3) }: {
  label: string
  value: number
  good: boolean
  bad: boolean
  fmt?: (v: number) => string
}) {
  const color = good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-amber-400'
  const icon  = good ? '✓' : bad ? '✗' : '~'
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-800">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs font-mono font-semibold ${color}`}>
        {icon} {fmt(value)}
      </span>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

const DEFAULT_S: Record<string, SParam> = {
  s11: { mag_db: -12, phase_deg: -80 },
  s12: { mag_db: -25, phase_deg:  60 },
  s21: { mag_db:  18, phase_deg: 100 },
  s22: { mag_db: -15, phase_deg: -70 },
}

export function StabilityPanel() {
  const [open, setOpen] = useState(false)
  const [s11, setS11] = useState<SParam>(DEFAULT_S.s11)
  const [s12, setS12] = useState<SParam>(DEFAULT_S.s12)
  const [s21, setS21] = useState<SParam>(DEFAULT_S.s21)
  const [s22, setS22] = useState<SParam>(DEFAULT_S.s22)

  const result = useMemo(
    () => analyzeStability(s11, s12, s21, s22),
    [s11, s12, s21, s22],
  )

  function loadPreset(key: string) {
    const p = PRESETS[key]
    setS11(p.s11); setS12(p.s12); setS21(p.s21); setS22(p.s22)
  }

  const verdict = result.unconditionallyStable
    ? { text: 'Unconditionally Stable', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800' }
    : { text: 'Potentially Unstable', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' }

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>◎ Stability Analysis</span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">

          {/* Presets */}
          <div>
            <p className="text-[10px] text-gray-600 mb-1.5">Load preset</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* S-param inputs */}
          <div className="grid grid-cols-2 gap-2">
            <SParamInput label="S₁₁" value={s11} onChange={setS11} />
            <SParamInput label="S₁₂" value={s12} onChange={setS12} />
            <SParamInput label="S₂₁" value={s21} onChange={setS21} />
            <SParamInput label="S₂₂" value={s22} onChange={setS22} />
          </div>

          {/* Verdict */}
          <div className={`rounded-lg px-3 py-2 border text-center ${verdict.bg}`}>
            <p className={`text-sm font-bold ${verdict.color}`}>{verdict.text}</p>
          </div>

          {/* Metrics */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
            <MetricRow
              label="Rollett K-factor"
              value={result.K}
              good={result.K > 1}
              bad={result.K <= 0.5}
              fmt={(v) => v.toFixed(3)}
            />
            <MetricRow
              label="|Δ|"
              value={result.delta_mag}
              good={result.delta_mag < 1}
              bad={result.delta_mag >= 1}
              fmt={(v) => v.toFixed(4)}
            />
            <MetricRow
              label="μ (source)"
              value={result.mu_source}
              good={result.mu_source > 1}
              bad={result.mu_source <= 0.8}
              fmt={(v) => v.toFixed(3)}
            />
            <MetricRow
              label="μ' (load)"
              value={result.mu_load}
              good={result.mu_load > 1}
              bad={result.mu_load <= 0.8}
              fmt={(v) => v.toFixed(3)}
            />
          </div>

          {/* Stability criterion reminder */}
          <p className="text-[9px] text-gray-700 leading-relaxed">
            Unconditionally stable iff K &gt; 1 <em>and</em> |Δ| &lt; 1 (Rollett), or equivalently μ &gt; 1.
            Input/output stability circles (dashed) show Γ regions that cause oscillation.
          </p>

          {/* Smith Chart */}
          <div>
            <p className="text-[10px] text-gray-500 mb-2">Stability Circles — Smith Chart</p>
            <div className="flex justify-center">
              <SmithChart
                inputCircle={result.inputCircle}
                outputCircle={result.outputCircle}
                s11={result.s11}
                s22={result.s22}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
