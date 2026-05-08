import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { PerStageResult } from '../../types'

interface Props {
  stages: PerStageResult[]
  totalNfDb: number
}

interface BudgetRow {
  name: string
  contribution: number   // linear noise factor contribution
  pct: number            // % of total noise factor
  contributionDb: number // dB equivalent (10*log10 of contribution, relative to total)
}

function dbToLinear(db: number) {
  return Math.pow(10, db / 10)
}

function computeBudget(stages: PerStageResult[], totalNfDb: number): BudgetRow[] {
  const totalF = dbToLinear(totalNfDb)

  return stages.map((s, i) => {
    const fCum = dbToLinear(s.cumulative_nf_db)
    const fPrev = i === 0 ? 0 : dbToLinear(stages[i - 1].cumulative_nf_db)
    const contribution = fCum - fPrev
    const pct = (contribution / totalF) * 100
    // dB contribution = 10*log10(contribution) but only meaningful relative to total
    // Show as "NF contribution in dB" = 10*log10(1 + contribution - 1) — just use % for display
    return {
      name: s.component_name.length > 10 ? s.component_name.slice(0, 10) + '…' : s.component_name,
      contribution,
      pct: parseFloat(pct.toFixed(1)),
      contributionDb: parseFloat((10 * Math.log10(contribution)).toFixed(2)),
    }
  })
}

// Color scale: red for the biggest contributor, amber for mid, gray for small
function barColor(pct: number, maxPct: number): string {
  const ratio = pct / maxPct
  if (ratio > 0.6) return '#f87171'   // red
  if (ratio > 0.25) return '#fbbf24'  // amber
  return '#6b7280'                    // gray
}

interface TooltipPayload {
  name: string
  value: number
  payload: BudgetRow
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
      <p className="text-gray-300 font-medium mb-1">{d.name}</p>
      <p className="text-amber-400">NF contribution: <span className="font-mono">{d.pct}%</span></p>
    </div>
  )
}

export function NoiseBudget({ stages, totalNfDb }: Props) {
  if (stages.length === 0) return null

  const budget = computeBudget(stages, totalNfDb)
  const maxPct = Math.max(...budget.map((b) => b.pct))
  const worstStage = budget.reduce((a, b) => (b.pct > a.pct ? b : a))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">NF Budget — per-stage contribution</p>
        <span className="text-[10px] text-red-400 font-mono">
          ⚠ worst: {worstStage.name} ({worstStage.pct}%)
        </span>
      </div>

      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={budget}
            layout="vertical"
            margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937' }} />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 9, fill: '#6b7280', formatter: (v: number) => `${v}%` }}>
              {budget.map((entry, index) => (
                <Cell key={index} fill={barColor(entry.pct, maxPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick insight */}
      {worstStage.pct > 80 && (
        <p className="text-[10px] text-red-400/80 bg-red-400/10 rounded px-2 py-1">
          💡 {worstStage.name} dominates {worstStage.pct}% of system NF — consider a lower-NF alternative or move it earlier in the chain.
        </p>
      )}
      {worstStage.pct <= 80 && budget.length > 1 && (
        <p className="text-[10px] text-gray-600 bg-gray-800/50 rounded px-2 py-1">
          💡 NF is distributed across stages. Largest contributor: {worstStage.name} ({worstStage.pct}%).
        </p>
      )}
    </div>
  )
}
