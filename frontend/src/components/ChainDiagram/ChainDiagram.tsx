import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,

  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeDragHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSpectraStore } from '../../store/useSpectraStore'
import { ComponentNode } from './ComponentNode'
import { InsertPicker } from './InsertPicker'
import { FloatingPalette } from './FloatingPalette'
import { EmptyState } from './EmptyState'

// Stable references — defined outside component to avoid ReactFlow warning #002
const NODE_TYPES = { rfComponent: ComponentNode }

const NODE_W = 180
const NODE_GAP = 80

interface PickerState {
  insertAtIndex: number
  screenX: number
  screenY: number
}

export function ChainDiagram() {
  const chain              = useSpectraStore((s) => s.chain)
  const rfEdges            = useSpectraStore((s) => s.rfEdges)
  const nodePositions      = useSpectraStore((s) => s.nodePositions)
  const clearChain         = useSpectraStore((s) => s.clearChain)
  const addRfEdge          = useSpectraStore((s) => s.addRfEdge)
  const removeRfEdge       = useSpectraStore((s) => s.removeRfEdge)
  const updateNodePosition = useSpectraStore((s) => s.updateNodePosition)
  const removeFromChain    = useSpectraStore((s) => s.removeFromChain)

  const [picker, setPicker] = useState<PickerState | null>(null)

  // ── Nodes ────────────────────────────────────────────────────────────────
  const nodes: Node[] = useMemo(
    () =>
      chain.map((id, index) => ({
        id,
        type: 'rfComponent',
        // Use stored free position; fall back to auto-layout
        position: nodePositions[id] ?? { x: index * (NODE_W + NODE_GAP), y: 80 },
        data: { componentId: id, chainIndex: index },
        draggable: true,
      })),
    [chain, nodePositions],
  )

  // ── Edges — only manual connections, NO auto-wiring ──────────────────────
  const edges: Edge[] = useMemo(
    () =>
      rfEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        style: { stroke: '#6d28d9', strokeWidth: 2 },
        animated: false,
        deletable: true,
      })),
    [rfEdges],
  )

  // ── Drag-stop: save free position ─────────────────────────────────────────
  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      updateNodePosition(node.id, node.position)
    },
    [updateNodePosition],
  )

  // ── Manual connection drawn by user ───────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const edgeId = `e-${connection.source}-${connection.target}-${Date.now()}`
      addRfEdge({
        id: edgeId,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      })
    },
    [addRfEdge],
  )

  // ── Edge deletion: Backspace/Delete key OR double-click ───────────────────
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') removeRfEdge(change.id)
      }
    },
    [removeRfEdge],
  )

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      removeRfEdge(edge.id)
    },
    [removeRfEdge],
  )

  // ── Node deletion via keyboard Delete ────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          const idx = chain.indexOf(change.id)
          if (idx !== -1) removeFromChain(idx)
        }
      }
    },
    [chain, removeFromChain],
  )

  if (chain.length === 0) return <EmptyState />

  return (
    <div className="flex flex-col h-full">
      {/* Fixed top toolbar */}
      <FloatingPalette />

      {/* Canvas area */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
          {rfEdges.length > 0 && (
            <button
              onClick={() => useSpectraStore.getState().clearRfEdges()}
              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 rounded transition-colors"
            >
              Clear Wires
            </button>
          )}
          <button
            onClick={clearChain}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-red-800 text-gray-400 hover:text-white border border-gray-700 hover:border-red-600 rounded transition-colors"
          >
            Clear Chain
          </button>
        </div>

        <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={3}
        colorMode="dark"
        deleteKeyCode={['Backspace', 'Delete']}
        connectionRadius={30}
        snapToGrid={false}
      >
        <Background variant={BackgroundVariant.Dots} color="#1f2937" gap={20} />
        <Controls />
      </ReactFlow>

        {picker && (
          <InsertPicker
            insertAtIndex={picker.insertAtIndex}
            screenX={picker.screenX}
            screenY={picker.screenY}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  )
}
