import { Handle, Position } from '@xyflow/react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { ParameterBadge } from '../shared/ParameterBadge'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', Attenuator: '▼', Mixer: '×', Filter: '≋', Generic: '□',
}

interface NodeData {
  componentId: string
  chainIndex: number
}

export function ComponentNode({ data }: { data: NodeData }) {
  const component = useSpectraStore((s) => s.components[data.componentId])
  const removeFromChain = useSpectraStore((s) => s.removeFromChain)

  if (!component) return null

  return (
    <div className="group relative bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-w-[140px] shadow-lg hover:border-violet-500 transition-colors">
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />

      <button
        onClick={() => removeFromChain(data.chainIndex)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white rounded-full text-xs items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex"
      >
        ×
      </button>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{TYPE_ICON[component.type] ?? '□'}</span>
        <span className="text-xs text-gray-400">{component.type}</span>
      </div>

      <p className="text-sm font-medium text-gray-100 truncate max-w-[120px] mb-2">
        {component.name}
      </p>

      <div className="flex flex-col gap-1">
        <ParameterBadge label="G" value={component.gain_db} />
        <ParameterBadge label="NF" value={component.nf_db} positiveIsGood={false} />
        <ParameterBadge label="IIP3" value={component.iip3_dbm} unit="dBm" />
      </div>

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />
    </div>
  )
}
