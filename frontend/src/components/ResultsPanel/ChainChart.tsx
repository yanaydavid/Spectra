import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PerStageResult } from '../../types'

interface Props {
  stages: PerStageResult[]
}

export function ChainChart({ stages }: Props) {
  const data = stages.map((s) => ({
    name: s.component_name.length > 8 ? s.component_name.slice(0, 8) + '…' : s.component_name,
    'Gain (dB)': parseFloat(s.cumulative_gain_db.toFixed(2)),
    'NF (dB)': parseFloat(s.cumulative_nf_db.toFixed(2)),
  }))

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#6b7280' }}
            iconType="plainline"
          />
          <Line
            type="monotone"
            dataKey="Gain (dB)"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3, fill: '#34d399' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="NF (dB)"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ r: 3, fill: '#fbbf24' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
