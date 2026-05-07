import { useSpectraStore } from '../../store/useSpectraStore'
import { StageTable } from './StageTable'
import { SystemParamsForm } from './SystemParamsForm'

interface MetricCardProps {
  label: string
  value: number | null
  unit: string
  colorClass?: string
}

function MetricCard({ label, value, unit, colorClass = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-mono font-semibold ${colorClass}`}>
        {value === null ? <span className="text-gray-600">—</span> : value.toFixed(1)}
        {value !== null && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

export function ResultsPanel() {
  const cascadeResult = useSpectraStore((s) => s.cascadeResult)
  const calcError = useSpectraStore((s) => s.calcError)
  const r = cascadeResult

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Cascade Results
      </p>

      {calcError && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 rounded p-2">
          <span>⚠</span><span>{calcError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Cascaded NF"
          value={r?.cascaded_nf_db ?? null}
          unit="dB"
          colorClass="text-amber-400"
        />
        <MetricCard
          label="Total Gain"
          value={r?.total_gain_db ?? null}
          unit="dB"
          colorClass={r && r.total_gain_db >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard
          label="Cascaded IIP3"
          value={r?.cascaded_iip3_dbm ?? null}
          unit="dBm"
          colorClass="text-blue-400"
        />
        <MetricCard
          label="Sensitivity"
          value={r?.sensitivity_dbm ?? null}
          unit="dBm"
          colorClass="text-violet-400"
        />
      </div>

      {r && r.per_stage.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Per-stage breakdown</p>
          <StageTable stages={r.per_stage} />
        </div>
      )}

      {!r && (
        <p className="text-xs text-gray-600 text-center py-4">
          Add components to the chain to see results
        </p>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          System Parameters
        </p>
        <SystemParamsForm />
      </div>
    </div>
  )
}
