import type { PerStageResult } from '../../types'

interface Props {
  stages: PerStageResult[]
}

export function StageTable({ stages }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-1.5 pr-2 font-medium">#</th>
            <th className="text-left py-1.5 pr-2 font-medium">Component</th>
            <th className="text-right py-1.5 pr-2 font-medium">Cum. Gain</th>
            <th className="text-right py-1.5 font-medium">Cum. NF</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.stage_index} className="border-b border-gray-800/50">
              <td className="py-1.5 pr-2 text-gray-500">{s.stage_index + 1}</td>
              <td className="py-1.5 pr-2 text-gray-300 max-w-[80px] truncate">{s.component_name}</td>
              <td className={`py-1.5 pr-2 text-right font-mono ${s.cumulative_gain_db >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.cumulative_gain_db.toFixed(1)}
              </td>
              <td className="py-1.5 text-right font-mono text-amber-400">
                {s.cumulative_nf_db.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
