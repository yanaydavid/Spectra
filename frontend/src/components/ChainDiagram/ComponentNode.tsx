import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useSpectraStore } from '../../store/useSpectraStore'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', Attenuator: '▼', Mixer: '×', Filter: '≋', Generic: '□',
}

interface NodeData {
  componentId: string
  chainIndex: number
}

function NumInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <input
      type="number"
      step="0.1"
      defaultValue={value ?? ''}
      onBlur={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
    />
  )
}

export function ComponentNode({ data }: { data: NodeData }) {
  const component = useSpectraStore((s) => s.components[data.componentId])
  const removeFromChain = useSpectraStore((s) => s.removeFromChain)
  const updateComponent = useSpectraStore((s) => s.updateComponent)
  const [editing, setEditing] = useState(false)

  if (!component) return null

  return (
    <div className="group relative bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-w-[150px] shadow-lg hover:border-violet-500 transition-colors">
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />

      <button
        onClick={() => removeFromChain(data.chainIndex)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white rounded-full text-xs items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex"
      >
        ×
      </button>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{TYPE_ICON[component.type] ?? '□'}</span>
        <span className="text-xs text-gray-400 flex-1">{component.type}</span>
        <button
          onClick={() => setEditing((e) => !e)}
          title={editing ? 'Done' : 'Edit params'}
          className="text-[10px] text-gray-600 hover:text-violet-400 transition-colors"
        >
          {editing ? '✓' : '✎'}
        </button>
      </div>

      <p className="text-sm font-medium text-gray-100 truncate max-w-[130px] mb-2">
        {component.name}
      </p>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-gray-500">Gain (dB)
            <NumInput value={component.gain_db} onChange={(v) => updateComponent(component.id, { gain_db: v as number })} />
          </label>
          <label className="text-[10px] text-gray-500">NF (dB)
            <NumInput value={component.nf_db} onChange={(v) => updateComponent(component.id, { nf_db: v as number })} />
          </label>
          <label className="text-[10px] text-gray-500">IIP3 (dBm)
            <NumInput value={component.iip3_dbm} onChange={(v) => updateComponent(component.id, { iip3_dbm: v as number | null })} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-xs font-mono">
          <span className="text-gray-400">G <span className="text-emerald-400">{component.gain_db} dB</span></span>
          <span className="text-gray-400">NF <span className="text-amber-400">{component.nf_db} dB</span></span>
          {component.iip3_dbm !== null && component.iip3_dbm !== undefined && (
            <span className="text-gray-400">IIP3 <span className="text-blue-400">{component.iip3_dbm} dBm</span></span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />
    </div>
  )
}
