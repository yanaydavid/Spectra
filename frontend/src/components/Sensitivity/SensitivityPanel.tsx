/**
 * Sensitivity / What-If Panel
 *
 * Two tabs:
 *   Sensitivity — table of leverage coefficients per stage
 *   What-If     — per-stage parameter sliders → live cascade delta
 */

import { useState, useMemo } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import {
  computeSensitivity, computeWhatIf,
  type StageSensitivity, type ParamDelta,
} from '../../utils/sensitivity'

type Tab = 'sensitivity' | 'whatif'

// ── helpers ───────────────────────────────────────────────────────────────────

function leverageColor(v: number, kind: 'nf' | 'gain' | 'iip3') {
  if (kind === 'nf') {
    if (v >= 0.7) return 'text-red-400'
    if (v >= 0.3) return 'text-amber-400'
    return 'text-emerald-400'
  }
  if (kind === 'gain') return 'text-emerald-400'
  if (v >= 0.5) return 'text-red-400'
  if (v >= 0.2) return 'text-amber-400'
  return 'text-gray-500'
}

function DeltaBadge({ value, unit, invert = false }: { value: number; unit: string; invert?: boolean }) {
  const improved = invert ? value < 0 : value > 0
  const neutral  = Math.abs(value) < 0.01
  const color    = neutral ? 'text-gray-600' : improved ? 'text-emerald-400' : 'text-red-400'
  const sign     = value > 0 ? '+' : ''
  return (
    <span className={`font-mono text-xs ${color}`}>
      {neutral ? '—' : `${sign}${value.toFixed(1)} ${unit}`}
    </span>
  )
}

// ── Sensitivity tab ───────────────────────────────────────────────────────────

function SensitivityTab({ sens }: { sens: StageSensitivity[] }) {
  if (sens.length === 0) {
    return <p className="text-xs text-gray-600 text-center py-3">Add components to the chain</p>
  }
  return (
    <div className="space-y-3">
      <p className="text-[9px] text-gray-600 leading-relaxed">
        Leverage = cascade improvement per 1 dB improvement in stage parameter.
        Higher NF leverage → that stage dominates noise.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-600 border-b border-gray-800">
              <th className="text-left py-1 pr-2 font-medium">Stage</th>
              <th className="text-right py-1 px-1 font-medium" title="NF improvement leverage">NF lev.</th>
              <th className="text-right py-1 px-1 font-medium" title="Gain leverage">G lev.</th>
              <th className="text-right py-1 pl-1 font-medium" title="IIP3 improvement leverage">IIP3 lev.</th>
            </tr>
          </thead>
          <tbody>
            {sens.map((s) => (
              <tr key={s.stageIndex} className="border-b border-gray-800/50">
                <td className="py-1.5 pr-2 text-gray-400 truncate max-w-[90px]">{s.componentName}</td>
                <td className={`py-1.5 px-1 text-right font-mono ${leverageColor(s.nfLeverage, 'nf')}`}>
                  {s.nfLeverage.toFixed(2)}
                </td>
                <td className={`py-1.5 px-1 text-right font-mono ${leverageColor(s.gainLeverage, 'gain')}`}>
                  {s.gainLeverage.toFixed(2)}
                </td>
                <td className={`py-1.5 pl-1 text-right font-mono ${leverageColor(s.iip3Leverage, 'iip3')}`}>
                  {s.iip3Leverage.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[9px]">
        <div className="bg-gray-900 rounded p-1.5 border border-gray-800">
          <p className="text-red-400 font-semibold mb-0.5">≥ 0.7</p>
          <p className="text-gray-600">Bottleneck — fix this first</p>
        </div>
        <div className="bg-gray-900 rounded p-1.5 border border-gray-800">
          <p className="text-amber-400 font-semibold mb-0.5">0.3–0.7</p>
          <p className="text-gray-600">Moderate impact</p>
        </div>
        <div className="bg-gray-900 rounded p-1.5 border border-gray-800">
          <p className="text-emerald-400 font-semibold mb-0.5">&lt; 0.3</p>
          <p className="text-gray-600">Low leverage</p>
        </div>
      </div>
    </div>
  )
}

// ── What-If tab ───────────────────────────────────────────────────────────────

function DeltaSlider({
  label, value, onChange, min = -10, max = 10, step = 0.5, unit = 'dB',
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; unit?: string
}) {
  const sign = value > 0 ? '+' : ''
  const color = Math.abs(value) < 0.01 ? 'text-gray-600' : value < 0 ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-gray-600">{label}</span>
        <span className={`text-[9px] font-mono ${color}`}>
          {Math.abs(value) < 0.01 ? '0' : `${sign}${value.toFixed(1)}`} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none bg-gray-700 rounded-full outline-none
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                   [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  )
}

function WhatIfTab({
  chain,
  components,
  cascadeResult,
}: {
  chain: string[]
  components: Record<string, import('../../types').RFComponent>
  cascadeResult: import('../../types').CascadeResult | null
}) {
  const stages = chain.map((id) => components[id]).filter(Boolean)

  const emptyDeltas = () =>
    Object.fromEntries(stages.map((s) => [s.id, { gain_db: 0, nf_db: 0, iip3_dbm: 0 }]))

  const [deltas, setDeltas] = useState<Record<string, ParamDelta>>(emptyDeltas)

  const setDelta = (id: string, param: keyof ParamDelta) => (v: number) =>
    setDeltas((prev) => ({ ...prev, [id]: { ...prev[id], [param]: v } }))

  const resetAll = () => setDeltas(emptyDeltas())

  const result = useMemo(
    () => computeWhatIf(chain, components, deltas),
    [chain, components, deltas],
  )

  const anyNonZero = Object.values(deltas).some(
    (d) => Math.abs(d.gain_db) > 0.01 || Math.abs(d.nf_db) > 0.01 || Math.abs(d.iip3_dbm) > 0.01
  )

  if (stages.length === 0) {
    return <p className="text-xs text-gray-600 text-center py-3">Add components to the chain</p>
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className={`rounded-lg border px-3 py-2 ${anyNonZero ? 'border-violet-800 bg-violet-950/30' : 'border-gray-800 bg-gray-900'}`}>
        <p className="text-[9px] text-gray-500 mb-1.5">Cascade result with your changes</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'NF',   val: result.nf_db,    unit: 'dB',  delta: result.deltaNf,   invert: true },
            { label: 'Gain', val: result.gain_db,   unit: 'dB',  delta: result.deltaGain, invert: false },
            { label: 'IIP3', val: result.iip3_dbm,  unit: 'dBm', delta: result.deltaIip3, invert: false },
          ].map(({ label, val, unit, delta, invert }) => (
            <div key={label}>
              <p className="text-[9px] text-gray-600">{label}</p>
              <p className="text-xs font-mono text-gray-200">{val.toFixed(1)} <span className="text-gray-600">{unit}</span></p>
              <DeltaBadge value={delta} unit={unit} invert={invert} />
            </div>
          ))}
        </div>
      </div>

      {/* Per-stage sliders */}
      {stages.map((s) => (
        <div key={s.id} className="bg-gray-900 rounded-lg border border-gray-800 p-2.5 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 truncate">{s.name}</p>
          <DeltaSlider
            label="Δ Gain" value={deltas[s.id]?.gain_db ?? 0}
            onChange={setDelta(s.id, 'gain_db')} min={-10} max={10}
          />
          <DeltaSlider
            label="Δ NF (−=improve)" value={deltas[s.id]?.nf_db ?? 0}
            onChange={setDelta(s.id, 'nf_db')} min={-5} max={5} step={0.25}
          />
          {s.iip3_dbm != null && (
            <DeltaSlider
              label="Δ IIP3" value={deltas[s.id]?.iip3_dbm ?? 0}
              onChange={setDelta(s.id, 'iip3_dbm')} min={-10} max={10}
              unit="dBm"
            />
          )}
        </div>
      ))}

      {anyNonZero && (
        <button
          onClick={resetAll}
          className="w-full text-[10px] py-1.5 border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 rounded transition-colors"
        >
          Reset all to baseline
        </button>
      )}
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function SensitivityPanel() {
  const [open, setOpen]     = useState(false)
  const [tab,  setTab]      = useState<Tab>('sensitivity')

  const chain         = useSpectraStore((s) => s.chain)
  const components    = useSpectraStore((s) => s.components)
  const cascadeResult = useSpectraStore((s) => s.cascadeResult)

  const sens = useMemo(
    () => computeSensitivity(chain, components),
    [chain, components],
  )

  // Find top NF bottleneck for header badge
  const topBottleneck = sens.length > 0
    ? [...sens].sort((a, b) => b.nfLeverage - a.nfLeverage)[0]
    : null

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🎯 Sensitivity / What-If</span>
          {topBottleneck && topBottleneck.nfLeverage >= 0.7 && (
            <span className="text-[9px] bg-red-900/40 text-red-300 border border-red-800 rounded px-1 font-mono truncate max-w-[100px]">
              NF: {topBottleneck.componentName.slice(0, 8)}…
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
            {([['sensitivity', 'Sensitivity'], ['whatif', 'What-If']] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                  tab === key
                    ? 'bg-violet-700 text-white font-semibold'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'sensitivity' ? (
            <SensitivityTab sens={sens} />
          ) : (
            <WhatIfTab chain={chain} components={components} cascadeResult={cascadeResult} />
          )}
        </div>
      )}
    </div>
  )
}
