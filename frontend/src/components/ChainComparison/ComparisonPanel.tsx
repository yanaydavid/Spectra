import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { CascadeResult, RFComponent } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Snapshot {
  name: string
  result: CascadeResult
  stages: { name: string; type: string; gain_db: number; nf_db: number; iip3_dbm: number }[]
  capturedAt: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b']

function delta(a: number, b: number, lowerIsBetter = false) {
  const d = b - a
  const better = lowerIsBetter ? d < 0 : d > 0
  const sign = d > 0 ? '+' : ''
  return { text: `${sign}${d.toFixed(2)}`, better, worse: lowerIsBetter ? d > 0 : d < 0 }
}

// ── Metric comparison row ─────────────────────────────────────────────────────

function MetricRow({
  label,
  unit,
  snapshots,
  field,
  lowerIsBetter = false,
}: {
  label: string
  unit: string
  snapshots: Snapshot[]
  field: keyof CascadeResult
  lowerIsBetter?: boolean
}) {
  const values = snapshots.map((s) => s.result[field] as number)
  const best = lowerIsBetter ? Math.min(...values) : Math.max(...values)

  return (
    <tr className="border-b border-gray-800/50">
      <td className="py-2 pr-3 text-[10px] text-gray-500 whitespace-nowrap">{label}</td>
      {snapshots.map((s, i) => {
        const v = s.result[field] as number
        const isBest = Math.abs(v - best) < 0.001
        return (
          <td key={i} className="py-2 px-2 text-center">
            <span className={`text-xs font-mono font-semibold ${isBest ? 'text-violet-400' : 'text-gray-300'}`}>
              {v.toFixed(2)}
              {isBest && <span className="ml-1 text-[9px] text-violet-500">★</span>}
            </span>
            <span className="text-[9px] text-gray-600 ml-0.5">{unit}</span>
          </td>
        )
      })}
      {snapshots.length === 2 && (() => {
        const d = delta(values[0], values[1], lowerIsBetter)
        return (
          <td className="py-2 px-2 text-center">
            <span className={`text-[10px] font-mono ${
              d.better ? 'text-emerald-400' : d.worse ? 'text-red-400' : 'text-gray-500'
            }`}>
              {d.text}
            </span>
          </td>
        )
      })()}
    </tr>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ComparisonPanel() {
  const [open, setOpen] = useState(false)
  const chain         = useSpectraStore((s) => s.chain)
  const components    = useSpectraStore((s) => s.components)
  const cascadeResult = useSpectraStore((s) => s.cascadeResult)

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [snapName, setSnapName]   = useState('')

  function capture() {
    if (!cascadeResult || chain.length === 0) return
    const name = snapName.trim() || `Design ${String.fromCharCode(65 + snapshots.length)}`
    const stages = chain
      .map((id) => components[id])
      .filter(Boolean)
      .map((c: RFComponent) => ({
        name: c.name, type: c.type,
        gain_db: c.gain_db, nf_db: c.nf_db, iip3_dbm: c.iip3_dbm ?? 0,
      }))

    setSnapshots((prev) => {
      const updated = [...prev, { name, result: cascadeResult, stages, capturedAt: Date.now() }]
      return updated.slice(-3)   // keep max 3
    })
    setSnapName('')
  }

  function remove(i: number) {
    setSnapshots((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Chart data — NF and Gain bars per snapshot
  const chartData = [
    { metric: 'NF (dB)',      ...Object.fromEntries(snapshots.map((s, i) => [s.name, parseFloat(s.result.cascaded_nf_db.toFixed(2))])) },
    { metric: 'Gain (dB)',    ...Object.fromEntries(snapshots.map((s, i) => [s.name, parseFloat(s.result.total_gain_db.toFixed(2))])) },
    { metric: 'IIP3 (dBm)',   ...Object.fromEntries(snapshots.map((s, i) => [s.name, parseFloat(s.result.cascaded_iip3_dbm.toFixed(2))])) },
    { metric: 'Sens. (dBm)',  ...Object.fromEntries(snapshots.map((s, i) => [s.name, parseFloat(s.result.sensitivity_dbm.toFixed(2))])) },
  ]

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>⊞ Chain Comparison</span>
        <span className="text-[10px] text-gray-700">{snapshots.length > 0 ? `${snapshots.length} design${snapshots.length > 1 ? 's' : ''}` : ''} {open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">

          {/* Capture current chain */}
          <div className="flex gap-2">
            <input
              type="text"
              value={snapName}
              onChange={(e) => setSnapName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && capture()}
              placeholder={`Design ${String.fromCharCode(65 + snapshots.length)}…`}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={capture}
              disabled={!cascadeResult || chain.length === 0}
              className="px-3 py-1 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-xs rounded transition-colors whitespace-nowrap"
            >
              Snapshot
            </button>
          </div>

          {!cascadeResult && chain.length === 0 && (
            <p className="text-[10px] text-gray-600 text-center">Build a chain to snapshot it</p>
          )}

          {/* Snapshot chips */}
          {snapshots.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {snapshots.map((s, i) => (
                <div key={i}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                  style={{ borderColor: COLORS[i] + '80', background: COLORS[i] + '18', color: COLORS[i] }}
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-gray-600">({s.stages.length} stages)</span>
                  <button onClick={() => remove(i)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Comparison table */}
          {snapshots.length >= 2 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 pr-3 text-[10px] text-gray-600 font-medium">Metric</th>
                      {snapshots.map((s, i) => (
                        <th key={i} className="py-2 px-2 text-center text-[10px] font-semibold"
                          style={{ color: COLORS[i] }}>
                          {s.name}
                        </th>
                      ))}
                      {snapshots.length === 2 && (
                        <th className="py-2 px-2 text-center text-[10px] text-gray-600 font-medium">Δ</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <MetricRow label="Cascaded NF"   unit="dB"  snapshots={snapshots} field="cascaded_nf_db"   lowerIsBetter />
                    <MetricRow label="Total Gain"    unit="dB"  snapshots={snapshots} field="total_gain_db"    />
                    <MetricRow label="Cascaded IIP3" unit="dBm" snapshots={snapshots} field="cascaded_iip3_dbm"/>
                    <MetricRow label="Sensitivity"   unit="dBm" snapshots={snapshots} field="sensitivity_dbm"  lowerIsBetter />
                  </tbody>
                </table>
              </div>

              {/* Bar chart */}
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 10, borderRadius: 6 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {snapshots.map((s, i) => (
                      <Bar key={s.name} dataKey={s.name} fill={COLORS[i]} radius={[2, 2, 0, 0]} opacity={0.85} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stage breakdown per design */}
              <div className="space-y-2">
                {snapshots.map((s, i) => (
                  <details key={i} className="bg-gray-900 rounded border border-gray-800">
                    <summary
                      className="px-3 py-2 text-[10px] font-semibold cursor-pointer list-none flex items-center gap-2"
                      style={{ color: COLORS[i] }}
                    >
                      <span>▸ {s.name}</span>
                      <span className="text-gray-600 font-normal">{s.stages.map(st => st.name).join(' → ')}</span>
                    </summary>
                    <div className="px-3 pb-2">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-gray-600 border-b border-gray-800">
                            <th className="text-left py-1">Stage</th>
                            <th className="text-right py-1">Gain</th>
                            <th className="text-right py-1">NF</th>
                            <th className="text-right py-1">IIP3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.stages.map((st, j) => (
                            <tr key={j} className="border-b border-gray-800/40">
                              <td className="py-1 text-gray-300">{st.name}</td>
                              <td className="py-1 text-right font-mono text-emerald-400">{st.gain_db.toFixed(1)}</td>
                              <td className="py-1 text-right font-mono text-amber-400">{st.nf_db.toFixed(1)}</td>
                              <td className="py-1 text-right font-mono text-blue-400">{st.iip3_dbm.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}

          {snapshots.length === 1 && (
            <p className="text-[10px] text-gray-600 text-center py-1">
              Modify the chain and snapshot a second design to compare
            </p>
          )}
        </div>
      )}
    </div>
  )
}
