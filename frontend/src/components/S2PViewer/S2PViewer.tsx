/**
 * S2P Viewer Panel
 *
 * Shows plots and key stats for any chain stage that has Touchstone S2P data loaded.
 * Charts: |S21| gain (dB), |S11| return loss (dB), |S22| return loss (dB).
 * Stats: freq range, peak gain, BW at −3 dB, min S11.
 */

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { S2PFile, S2PPoint } from '../../utils/parseS2P'

type PlotMode = 'gain' | 'return_loss' | 'all'

const MODE_LABELS: { key: PlotMode; label: string }[] = [
  { key: 'gain',        label: '|S21| Gain'     },
  { key: 'return_loss', label: 'Return Loss'     },
  { key: 'all',         label: 'All S-params'   },
]

// ── stats helpers ─────────────────────────────────────────────────────────────

function toDb(mag: number) { return 20 * Math.log10(Math.max(mag, 1e-12)) }

function stats(file: S2PFile) {
  const pts = file.points
  if (pts.length === 0) return null

  const gains = pts.map((p) => p.gain_db)
  const peakGain = Math.max(...gains)
  const peakIdx  = gains.indexOf(peakGain)

  // −3 dB bandwidth
  const threshold = peakGain - 3
  let bwLow = pts[0].freq_ghz
  let bwHigh = pts[pts.length - 1].freq_ghz
  for (let i = 0; i < pts.length - 1; i++) {
    if (gains[i] < threshold && gains[i + 1] >= threshold) bwLow = pts[i + 1].freq_ghz
    if (gains[i] >= threshold && gains[i + 1] < threshold) bwHigh = pts[i].freq_ghz
  }

  const s11s = pts.map((p) => toDb(p.s11.mag))
  const s22s = pts.map((p) => toDb(p.s22.mag))

  return {
    fMin:      pts[0].freq_ghz,
    fMax:      pts[pts.length - 1].freq_ghz,
    nPoints:   pts.length,
    peakGain,
    peakFreq:  pts[peakIdx].freq_ghz,
    bw3db:     bwHigh - bwLow,
    minS11:    Math.min(...s11s),
    minS22:    Math.min(...s22s),
  }
}

// ── chart data builder ────────────────────────────────────────────────────────

function toChartData(pts: S2PPoint[]) {
  return pts.map((p) => ({
    f: parseFloat(p.freq_ghz.toFixed(4)),
    gain:  parseFloat(p.gain_db.toFixed(3)),
    s11:   parseFloat(toDb(p.s11.mag).toFixed(3)),
    s22:   parseFloat(toDb(p.s22.mag).toFixed(3)),
    s12:   parseFloat(toDb(p.s12.mag).toFixed(3)),
  }))
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatChip({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color: string
}) {
  return (
    <div className="bg-gray-900 rounded px-2 py-1.5 border border-gray-800">
      <p className="text-[9px] text-gray-600 mb-0.5">{label}</p>
      <p className={`text-xs font-mono font-semibold ${color}`}>
        {value}{unit && <span className="text-[10px] text-gray-600 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function S2PChart({ file, mode, freqGhz }: { file: S2PFile; mode: PlotMode; freqGhz: number }) {
  const data = useMemo(() => toChartData(file.points), [file])

  const lines: { key: string; color: string; label: string }[] = []
  if (mode === 'gain' || mode === 'all') {
    lines.push({ key: 'gain', color: '#34d399', label: '|S21| dB' })
  }
  if (mode === 'return_loss' || mode === 'all') {
    lines.push({ key: 's11', color: '#f87171', label: '|S11| dB' })
    lines.push({ key: 's22', color: '#fb923c', label: '|S22| dB' })
  }
  if (mode === 'all') {
    lines.push({ key: 's12', color: '#94a3b8', label: '|S12| dB' })
  }

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="f"
            tick={{ fill: '#6b7280', fontSize: 9 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
            label={{ value: 'GHz', position: 'insideBottomRight', fontSize: 9, fill: '#4b5563', offset: -4 }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            unit=" dB"
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', fontSize: 10, borderRadius: 6 }}
            labelFormatter={(v) => `${Number(v).toFixed(3)} GHz`}
            formatter={((val: unknown, name: string) => {
              const l = lines.find((x) => x.key === name)
              return [`${Number(val).toFixed(2)} dB`, l?.label ?? name]
            }) as never}
          />
          <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
          <ReferenceLine
            x={freqGhz}
            stroke="#7c3aed"
            strokeDasharray="4 2"
            label={{ value: `${freqGhz} GHz`, position: 'top', fontSize: 8, fill: '#7c3aed' }}
          />
          {lines.map(({ key, color, label }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function S2PViewer() {
  const [open, setOpen] = useState(false)
  const chain      = useSpectraStore((s) => s.chain)
  const components = useSpectraStore((s) => s.components)
  const s2pData    = useSpectraStore((s) => s.s2pData)
  const freqGhz    = useSpectraStore((s) => s.systemParams.frequency_ghz)

  // Only stages that have S2P data loaded
  const s2pStages = chain
    .map((id) => ({ id, comp: components[id], file: s2pData[id] }))
    .filter((x) => x.comp && x.file)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<PlotMode>('gain')

  // Auto-select first available stage
  const activeId = selectedId && s2pStages.find((x) => x.id === selectedId)
    ? selectedId
    : s2pStages[0]?.id ?? null

  const active = s2pStages.find((x) => x.id === activeId)
  const st = active ? stats(active.file) : null

  if (s2pStages.length === 0 && !open) {
    // Don't show collapsed header if no S2P data
    return null
  }

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📡 S-Parameter Viewer</span>
          {s2pStages.length > 0 && (
            <span className="text-[9px] bg-violet-900/60 text-violet-300 border border-violet-700 rounded px-1 font-mono">
              {s2pStages.length} loaded
            </span>
          )}
        </span>
        <span className="text-gray-700 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {s2pStages.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-3">
              Upload a .s2p file to a chain component to view S-parameters
            </p>
          ) : (
            <>
              {/* Stage selector */}
              {s2pStages.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {s2pStages.map(({ id, comp }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors truncate max-w-[120px] ${
                        id === activeId
                          ? 'bg-violet-700 border-violet-600 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-violet-600'
                      }`}
                    >
                      {comp.name}
                    </button>
                  ))}
                </div>
              )}

              {active && st && (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <StatChip label="Peak Gain"   value={st.peakGain.toFixed(1)}  unit="dB"  color="text-emerald-400" />
                    <StatChip label="Peak Freq"   value={st.peakFreq.toFixed(2)}  unit="GHz" color="text-violet-400" />
                    <StatChip label="BW −3dB"     value={st.bw3db > 0 ? (st.bw3db * 1000).toFixed(0) : '—'} unit="MHz" color="text-sky-400" />
                    <StatChip label="Min S11"     value={st.minS11.toFixed(1)}    unit="dB"  color="text-red-400" />
                    <StatChip label="Min S22"     value={st.minS22.toFixed(1)}    unit="dB"  color="text-orange-400" />
                    <StatChip label="Points"      value={String(st.nPoints)}                 color="text-gray-400" />
                  </div>

                  {/* Freq range */}
                  <p className="text-[9px] text-gray-600 font-mono">
                    {st.fMin.toFixed(3)} – {st.fMax.toFixed(3)} GHz &nbsp;·&nbsp;
                    {active.file.format} &nbsp;·&nbsp; Z₀ = {active.file.z0} Ω
                  </p>

                  {/* Plot mode tabs */}
                  <div className="flex gap-1">
                    {MODE_LABELS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`text-[9px] px-2 py-1 rounded border transition-colors ${
                          mode === key
                            ? 'bg-violet-700 border-violet-600 text-white'
                            : 'border-gray-700 text-gray-500 hover:border-violet-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Chart */}
                  <S2PChart file={active.file} mode={mode} freqGhz={freqGhz} />

                  <p className="text-[9px] text-gray-700 leading-relaxed">
                    Purple dashed line = system operating frequency.
                    Gain is used directly in the frequency sweep when S2P data is loaded.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
