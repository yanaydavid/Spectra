import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSpectraStore } from '../../store/useSpectraStore'
import { ComponentNode } from './ComponentNode'

const NODE_TYPES = { rfComponent: ComponentNode }
const NODE_WIDTH = 160
const H_GAP = 80

export function ChainDiagram() {
  const chain = useSpectraStore((s) => s.chain)
  const reorderChain = useSpectraStore((s) => s.reorderChain)
  const clearChain = useSpectraStore((s) => s.clearChain)

  const nodes: Node[] = useMemo(
    () =>
      chain.map((id, index) => ({
        id,
        type: 'rfComponent',
        position: { x: index * (NODE_WIDTH + H_GAP), y: 0 },
        data: { componentId: id, chainIndex: index },
        draggable: true,
      })),
    [chain],
  )

  const edges: Edge[] = useMemo(
    () =>
      chain.slice(0, -1).map((id, index) => ({
        id: `e-${index}`,
        source: id,
        target: chain[index + 1],
        style: { stroke: '#4b5563' },
        animated: false,
      })),
    [chain],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Only handle position changes for drag-to-reorder
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          const draggedIndex = chain.indexOf(change.id)
          if (draggedIndex === -1) continue
          // Determine new index based on x position
          const newIndex = Math.min(
            Math.max(0, Math.round(change.position.x / (NODE_WIDTH + H_GAP))),
            chain.length - 1,
          )
          if (newIndex !== draggedIndex) {
            reorderChain(draggedIndex, newIndex)
          }
        }
      }
    },
    [chain, reorderChain],
  )

  if (chain.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-600">
        <div className="text-center">
          <p className="text-4xl mb-3">◈</p>
          <p className="text-sm">Add components from the library to build your RF chain</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <button
        onClick={clearChain}
        className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-gray-800 hover:bg-red-800 text-gray-400 hover:text-white border border-gray-700 hover:border-red-600 rounded transition-colors"
      >
        Clear Chain
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} color="#1f2937" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
