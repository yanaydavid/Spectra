import { useState } from 'react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { StageTable } from './StageTable'
import { SystemParamsForm } from './SystemParamsForm'
import { ChainChart } from './ChainChart'
import { NoiseBudget } from './NoiseBudget'
import { LinkBudgetPanel } from './LinkBudgetPanel'
import { PresetsPanel } from '../shared/PresetsPanel'
import { ProjectsPanel } from '../shared/ProjectsPanel'
import { generateReport } from '../../utils/generateReport'
import { DynamicRangePanel } from './DynamicRangePanel'
import { exportChainJson, importChainFromFile, ImportError } from '../../utils/chainIO'

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

function exportToCsv(
  stages: { stage_index: number; component_name: string; cumulative_gain_db: number; cumulative_nf_db: number; cumulative_iip3_dbm?: number | null }[],
  summary: { cascaded_nf_db: number; total_gain_db: number; cascaded_iip3_dbm: number; sensitivity_dbm: number },
) {
  const rows = [
    ['Stage', 'Component', 'Cum. Gain (dB)', 'Cum. NF (dB)', 'Cum. IIP3 (dBm)'],
    ...stages.map((s) => [
      s.stage_index + 1,
      s.component_name,
      s.cumulative_gain_db.toFixed(2),
      s.cumulative_nf_db.toFixed(2),
      s.cumulative_iip3_dbm != null ? s.cumulative_iip3_dbm.toFixed(2) : '',
    ]),
    [],
    ['Cascaded NF (dB)', summary.cascaded_nf_db.toFixed(2)],
    ['Total Gain (dB)', summary.total_gain_db.toFixed(2)],
    ['Cascaded IIP3 (dBm)', summary.cascaded_iip3_dbm.toFixed(2)],
    ['Sensitivity (dBm)', summary.sensitivity_dbm.toFixed(2)],
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rf-chain.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsPanel() {
  const cascadeResult   = useSpectraStore((s) => s.cascadeResult)
  const calcError       = useSpectraStore((s) => s.calcError)
  const freqGhz         = useSpectraStore((s) => s.systemParams.frequency_ghz)
  const systemParams    = useSpectraStore((s) => s.systemParams)
  const chain           = useSpectraStore((s) => s.chain)
  const components      = useSpectraStore((s) => s.components)
  const addComponent    = useSpectraStore((s) => s.addComponent)
  const clearChain      = useSpectraStore((s) => s.clearChain)
  const addToChain      = useSpectraStore((s) => s.addToChain)
  const setSystemParams = useSpectraStore((s) => s.setSystemParams)

  const [importError, setImportError] = useState<string | null>(null)
  const [importOk, setImportOk]       = useState(false)
  const r = cascadeResult

  async function handleImport() {
    setImportError(null)
    setImportOk(false)
    try {
      const data = await importChainFromFile()
      // Load: clear chain, restore components + chain entries, then set system params
      clearChain()
      // Add all components from the file
      for (const comp of Object.values(data.components)) {
        addComponent(comp)
      }
      // Restore chain order (chain entries are already in components)
      for (const id of data.chain) {
        if (data.components[id]) addToChain(id)
      }
      if (data.systemParams) setSystemParams(data.systemParams)
      setImportOk(true)
      setTimeout(() => setImportOk(false), 3000)
    } catch (err) {
      if (err instanceof ImportError && err.message !== 'Cancelled.') {
        setImportError(err.message)
        setTimeout(() => setImportError(null), 5000)
      }
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Cascade Results
        </p>
        <div className="flex items-center gap-1.5">
          {/* Import JSON */}
          <button
            onClick={handleImport}
            title="Import chain from JSON file"
            className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors flex items-center gap-1"
          >
            {importOk ? <span className="text-emerald-400">✓ Loaded</span> : <><span>↑</span> Import</>}
          </button>
          {/* Export JSON */}
          {chain.length > 0 && (
            <button
              onClick={() => exportChainJson(chain, components, systemParams)}
              title="Export chain to JSON file"
              className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors flex items-center gap-1"
            >
              <span>↓</span> Export
            </button>
          )}
          {/* Design Report */}
          {r && chain.length > 0 && (
            <button
              onClick={() => generateReport(chain, components, systemParams, r)}
              className="text-[10px] px-2 py-1 bg-violet-700 hover:bg-violet-600 text-white rounded transition-colors flex items-center gap-1"
            >
              <span>↓</span> Report
            </button>
          )}
        </div>
      </div>
      {importError && (
        <div className="text-[10px] text-red-400 bg-red-400/10 rounded px-2 py-1.5 flex items-center gap-1">
          <span>⚠</span><span>{importError}</span>
        </div>
      )}

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

      {r && (
        <DynamicRangePanel
          iip3_dbm={r.cascaded_iip3_dbm}
          sensitivity_dbm={r.sensitivity_dbm}
        />
      )}

      {r && r.per_stage.length > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Gain &amp; NF along chain</p>
          <ChainChart stages={r.per_stage} />
        </div>
      )}

      {r && r.per_stage.length > 0 && (
        <div className="border-t border-gray-800 pt-3">
          <NoiseBudget stages={r.per_stage} totalNfDb={r.cascaded_nf_db} />
        </div>
      )}

      {r && r.per_stage.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Per-stage breakdown</p>
            <button
              onClick={() => exportToCsv(r.per_stage, r)}
              className="text-[10px] px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
            >
              Export CSV
            </button>
          </div>
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

      <LinkBudgetPanel sensitivityDbm={r?.sensitivity_dbm ?? null} freqGhz={freqGhz} />

      <div className="border-t border-gray-800 pt-3">
        <PresetsPanel />
      </div>

      <ProjectsPanel />
    </div>
  )
}
