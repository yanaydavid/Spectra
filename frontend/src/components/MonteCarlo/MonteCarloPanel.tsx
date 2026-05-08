import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useSpectraStore } from '../../store/useSpectraStore'
import {
  runMonteCarlo, computeStats, buildHistogram,
  type MonteCarloParams,
} from '../../utils/monteCarlo'

type Metric = 'nf' | 'gain' | 'iip3'

const METRIC_META: Record<Metric, { label: string; unit: string; color: string }> = {
  nf:   { label: 'Cascaded NF',   unit: 'dB',  color: '#fbbf24' },
  gain: { label: 'Total Gain',    unit: 'dB',  color: '#34d399' },
  iip3: { label: 'Cascaded IIP3', unit: 'dBm', color: '#60a5fa' },
}

function StatRow({ label, value, unit, highlight = false }: {
  label: string; value: number; unit: string; highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs font-mono ${highlight ? 'text-white font-semibold' : 'text-gray-300'}`}>
        {value.toFixed(2)} <span className="text-gray-600 text-[9px]">{unit}</span>
      </span>
    </div>
  )
}

export function MonteCarloPanel() {
  const [open, setOpen] = useState(false)
  const chain      = useSpectraStore((s) => s.chain)
  const components = useSpectraStore((s) => s.components)
  const nominalResult = useSpectraStore((s) => s.cascadeResult)

  const [params, setParams] = useState<MonteCarloParams>({
    iterations: 1000,
    gain_tol_db: 0.5,
    nf_tol_db:   0.3,
    iip3_tol_db: 1.0,
  })
  const [metric, setMetric] = useState<Metric>('nf')
  const [hasRun, setHasRun] = useState(false)
  const [mcResult, setMcResult] = useState<{ nf: number[]; gain: number[]; iip3: number[] } | null>(null)

  const meta = METRIC_META[metric]

  function handleRun() {
    const result = runMonteCarlo(chain, components, params)
    setMcResult(result)
    setHasRun(true)
  }

  const stats = useMemo(() => {
    if (!mcResult) return null
    return computeStats(mcResult[metric])
  }, [mcResult, metric])

  const histogram = useMemo(() => {
    if (!mcResult) return []
    return buildHistogram(mcResult[metric], 30)
  }, [mcResult, metric])

  const nominal = nominalResult
    ? metric === 'nf'   ? nominalResult.cascaded_nf_db
    : metric === 'gain' ? nominalResult.total_gain_db
    :                     nominalResult.cascaded_iip3_dbm
    : null

  const setParam = (k: keyof MonteCarloParams) => (v: number) =>
    setParams((p) => ({ ...p, [k]: v }))

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>⟳ Monte Carlo</span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">

          {chain.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-2">Add components to the chain first</p>
          )}

          {chain.length > 0 && (
            <>
              {/* Tolerance inputs */}
              <div className="space-y-2">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider">Component Tolerances (±)</p>
                {[
                  { label: 'Gain tolerance', key: 'gain_tol_db' as const, step: 0.1 },
                  { label: 'NF tolerance',   key: 'nf_tol_db'   as const, step: 0.1 },
                  { label: 'IIP3 tolerance', key: 'iip3_tol_db' as const, step: 0.5 },
                ].map(({ label, key, step }) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 w-28 shrink-0">{label}</label>
                    <input
                      type="number"
                      step={step}
                      min={0}
                      value={params[key]}
                      onChange={(e) => setParam(key)(Number(e.target.value))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 text-right"
                    />
                    <span className="text-[10px] text-gray-600">dB</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-500 w-28 shrink-0">Iterations</label>
                  <select
                    value={params.iterations}
                    onChange={(e) => setParam('iterations')(Number(e.target.value))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500"
                  >
                    {[500, 1000, 2000, 5000].map((n) => (
                      <option key={n} value={n}>{n.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Run button */}
              <button
                onClick={handleRun}
                className="w-full py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded transition-colors"
              >
                Run {params.iterations.toLocaleString()} Simulations
              </button>

              {/* Results */}
              {hasRun && stats && (
                <>
                  {/* Metric selector */}
                  <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
                    {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        className={`flex-1 py-1 transition-colors ${
                          metric === m ? 'bg-violet-700 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {METRIC_META[m].label}
                      </button>
                    ))}
                  </div>

                  {/* Histogram */}
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogram} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                          dataKey="x"
                          tick={{ fill: '#6b7280', fontSize: 8 }}
                          tickLine={false}
                          axisLine={{ stroke: '#374151' }}
                          tickFormatter={(v) => v.toFixed(1)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 10 }}
                          formatter={(v: number, _: string, props: { payload: { x: number } }) =>
                            [`${v} samples`, `${props.payload.x.toFixed(2)} ${meta.unit}`]
                          }
                          labelFormatter={() => ''}
                        />
                        {nominal !== null && (
                          <ReferenceLine
                            x={histogram.reduce((closest, b) =>
                              Math.abs(b.x - nominal!) < Math.abs(closest.x - nominal!) ? b : closest
                            ).x}
                            stroke="#a78bfa"
                            strokeDasharray="4 2"
                            label={{ value: 'nominal', position: 'top', fontSize: 8, fill: '#a78bfa' }}
                          />
                        )}
                        <Bar dataKey="count" fill={meta.color} opacity={0.8} radius={[1, 1, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stats table */}
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 space-y-0.5">
                    <StatRow label="Mean"          value={stats.mean} unit={meta.unit} highlight />
                    <StatRow label="Std deviation" value={stats.std}  unit={meta.unit} />
                    <StatRow label="Best case (5%)"  value={stats.p5}  unit={meta.unit} />
                    <StatRow label="Worst case (95%)" value={stats.p95} unit={meta.unit} />
                    <StatRow label="Absolute min"  value={stats.min} unit={meta.unit} />
                    <StatRow label="Absolute max"  value={stats.max} unit={meta.unit} />
                    {nominal !== null && (
                      <div className="pt-1 border-t border-gray-800 mt-1">
                        <StatRow
                          label="Nominal (no tolerance)"
                          value={nominal}
                          unit={meta.unit}
                          highlight
                        />
                        <StatRow
                          label="Worst-case drift"
                          value={Math.abs(stats.p95 - nominal)}
                          unit={meta.unit}
                        />
                      </div>
                    )}
                  </div>

                  {/* Insight */}
                  {stats.std > 0 && (
                    <p className="text-[10px] text-gray-600 bg-gray-800/50 rounded px-2 py-1.5 leading-relaxed">
                      💡 {meta.label} varies by <span className="text-gray-400">±{(stats.p95 - stats.p5).toFixed(2)} {meta.unit}</span> across 90% of samples (P5–P95).
                      {stats.std > 1 && ' Consider tighter component tolerances.'}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
