/**
 * InsertEdge
 *
 * Custom ReactFlow edge that renders a "+" button at the midpoint.
 * Clicking it fires onInsert(insertAfterIndex) so the parent can
 * open the component picker and inject a stage at that position.
 */

import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react'

interface InsertEdgeData {
  insertAfterIndex: number
  onInsert: (idx: number) => void
}

export function InsertEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  const { insertAfterIndex, onInsert } = (data ?? {}) as unknown as InsertEdgeData

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#4b5563' }} />
      <EdgeLabelRenderer>
        <button
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan w-5 h-5 rounded-full bg-gray-800 border border-gray-600 hover:bg-violet-700 hover:border-violet-500 text-gray-500 hover:text-white text-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 shadow"
          title="Insert component here"
          onClick={(e) => {
            e.stopPropagation()
            onInsert(insertAfterIndex)
          }}
        >
          +
        </button>
      </EdgeLabelRenderer>
    </>
  )
}
