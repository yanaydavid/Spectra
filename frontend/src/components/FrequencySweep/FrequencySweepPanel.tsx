import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useSpectraStore } from '../../store/useSpectraStore'
import {
  runSweep, DEFAULT_ROLLOFFS,
  type FreqRolloff, type SweepPoint,
} from '../../utils/frequencySweep'

type Metric = 'nf_db' | 'gain_db' | 'iip3_dbm' | 'sensitivity_dbm'

const METRICS: { key: Metric; label: string; color: string; unit: string }[] = [
  { key: 'nf_db',           label: 'NF',          color: '#fbbf24', unit: 'dB'  },
  { key: 'gain_db',         label: 'Gain',         color: '#34d399', unit: 'dB'  },
  { key: 'iip3_dbm',        label: 'IIP3',         color: '#60a5fa', unit: 'dBm' },
  { key: 'sensitivity_dbm', label: 'Sensitivity',  color: '#a78bfa', unit: 'dBm' },
]

function RolloffRow({
  id, name, rolloff, onChange,
}: {
  id: string
  name: string
  rolloff: FreqRolloff
  onChange: (r: FreqRolloff) => void
}) {
  const set = (k: keyof FreqRolloff) => (v: number) => onChange({ ...rolloff, [k]: v })
  return (
    <div className="bg-gray-900 rounded p-2 space-y-1">
      <p className="text-[10px] font-semibold text-gray-400 truncate">{name}</p>
      <div className="grid grid-cols-3 gap-1">
        {([
          ['Gain', 'gain_slope'],
          ['NF',   'nf_slope'],
          ['IIP3', 'iip3_slope'],
        ] as [string, keyof FreqRolloff][]).map(([lbl, key]) => (
          <div key={key}>
            <label className="text-[9px] text-gray-600">{lbl} dB/GHz</label>
            <input
              type="number"
              step={0.05}
              value={rolloff[key]}
              onChange={(e) => set(key)(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200 focus:outline-none focus:border-violet-500 text-right"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FrequencySweepPanel() {
  const [open, setOpen] = useState(false)
  const chain      = useSpectraStore((s) => s.chain)
  const components = useSpectraStore((s) => s.components)
  const systemParams = useSpectraStore((s) => s.systemParams)
  const s2pData    = useSpectraStore((s) => s.s2pData)

  const center = systemParams.frequency_ghz ?? 2.4

  const [fStart, setFStart] = useState(parseFloat((center * 0.5).toFixed(2)))
  const [fStop,  setFStop]  = useState(parseFloat((center * 1.5).toFixed(2)))
  const [nPts,   setNPts]   = useState(51)
  const [visibleMetrics, setVisibleMetrics] = useState<Set<Metric>>(
    new Set(['nf_db', 'gain_db'])
  )

  const stages = chain.map((id) => components[id]).filter(Boolean)

  // Per-component rolloff state
  const [rolloffs, setRolloffs] = useState<Record<string, FreqRolloff>>(() =>
    Object.fromEntries(
      stages.map((s) => [s.id, DEFAULT_ROLLOFFS[s.type] ?? DEFAULT_ROLLOFFS.Generic])
    )
  )

  // Re-sync when chain changes (new stages get defaults)
  const allRolloffs = useMemo(() => {
    const r: Record<string, FreqRolloff> = {}
    for (const s of stages) {
      r[s.id] = rolloffs[s.id] ?? DEFAULT_ROLLOFFS[s.type] ?? DEFAULT_ROLLOFFS.Generic
    }
    return r
  }, [stages, rolloffs])

  const sweepData: SweepPoint[] = useMemo(() => {
    if (stages.length === 0 || fStart >= fStop) return []
    return runSweep(
      chain, components, allRolloffs,
      fStart, fStop, nPts,
      center,
      systemParams.bandwidth_hz,
      systemParams.temperature_k,
      s2pData,
    )
  }, [chain, components, allRolloffs, fStart, fStop, nPts, center, systemParams, s2pData])

  function toggleMetric(m: Metric) {
    setVisibleMetrics((prev) => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })
  }

  const activeMetrics = METRICS.filter((m) => visibleMetrics.has(m.key))

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>〜 Frequency Sweep</span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {chain.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-2">Add components to the chain first</p>
          ) : (
            <>
              {/* Frequency range */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Start (GHz)', val: fStart, set: setFStart, step: 0.1 },
                  { label: 'Stop (GHz)',  val: fStop,  set: setFStop,  step: 0.1 },
                  { label: 'Points',      val: nPts,   set: setNPts,   step: 10  },
                ].map(({ label, val, set, step }) => (
                  <div key={label}>
                    <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                    <input
                      type="number"
                      step={step}
                      value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
                    />
                  </div>
                ))}
              </div>

              {/* Metric toggles */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1.5">Show metrics</p>
                <div className="flex flex-wrap gap-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => toggleMetric(m.key)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        visibleMetrics.has(m.key)
                          ? 'border-transparent text-gray-900 font-semibold'
                          : 'border-gray-700 text-gray-500'
                      }`}
                      style={visibleMetrics.has(m.key) ? { background: m.color } : {}}
                    >
                      {m.label} ({m.unit})
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              {sweepData.length > 0 && activeMetrics.length > 0 && (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sweepData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis
                        dataKey="freq_ghz"
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={false}
                        tickFormatter={(v) => `${v.toFixed(1)}`}
                        label={{ value: 'GHz', position: 'insideBottomRight', fontSize: 9, fill: '#4b5563', offset: -4 }}
                      />
                      <YAxis
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 10, borderRadius: 6 }}
                        labelFormatter={(v) => `${Number(v).toFixed(2)} GHz`}
                        formatter={((val: unknown, name: string) => {
                          const m = METRICS.find((x) => x.key === name)
                          return [`${Number(val).toFixed(2)} ${m?.unit ?? ''}`, m?.label ?? name]
                        }) as never}
                      />
                      <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
                      {/* Center frequency reference line */}
                      <ReferenceLine
                        x={center}
                        stroke="#7c3aed"
                        strokeDasharray="4 2"
                        label={{ value: `${center} GHz`, position: 'top', fontSize: 8, fill: '#7c3aed' }}
                      />
                      {activeMetrics.map((m) => (
                        <Line
                          key={m.key}
                          type="monotone"
                          dataKey={m.key}
                          name={m.key}
                          stroke={m.color}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-component rolloff editors */}
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                  Frequency rolloff per stage
                </p>
                <div className="space-y-2">
                  {stages.map((s) => (
                    <div key={s.id}>
                      {s2pData[s.id] && (
                        <p className="text-[9px] text-violet-400 mb-0.5 flex items-center gap-1">
                          <span>S2P ✓</span>
                          <span className="text-gray-600">— gain from measured data; NF/IIP3 rolloff still applies</span>
                        </p>
                      )}
                      <RolloffRow
                        id={s.id}
                        name={s.name}
                        rolloff={allRolloffs[s.id] ?? DEFAULT_ROLLOFFS.Generic}
                        onChange={(r) => setRolloffs((prev) => ({ ...prev, [s.id]: r }))}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-gray-700 mt-2 leading-relaxed">
                  Rolloff = linear approximation of parameter degradation vs distance from center frequency.
                  Positive = parameter worsens as frequency moves away from nominal.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
