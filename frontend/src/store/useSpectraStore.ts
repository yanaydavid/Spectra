import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CascadeResult, Preset, PresetSnapshot, RFComponent, SystemParams } from '../types'
import type { S2PFile } from '../utils/parseS2P'

const NODE_W = 180
const NODE_GAP = 80

export interface RfEdge {
  id: string
  source: string      // component id
  target: string      // component id
  sourceHandle?: string | null
  targetHandle?: string | null
}

/**
 * Derive cascade order from graph edges (topological traversal).
 * Falls back to the raw chain array when no edges are present.
 */
export function deriveChainOrder(chain: string[], edges: RfEdge[]): string[] {
  if (edges.length === 0) return chain

  const targets = new Set(edges.map((e) => e.target))
  const nextOf: Record<string, string> = {}
  edges.forEach((e) => { nextOf[e.source] = e.target })

  // Root = first chain node that is not a target of any edge
  const root = chain.find((id) => !targets.has(id)) ?? chain[0]
  if (!root) return chain

  const result: string[] = []
  const seen = new Set<string>()
  let cur: string | undefined = root
  while (cur && !seen.has(cur)) {
    result.push(cur)
    seen.add(cur)
    cur = nextOf[cur]
  }
  // Append any disconnected nodes
  chain.forEach((id) => { if (!seen.has(id)) result.push(id) })
  return result
}

interface SpectraStore {
  // Component library (persisted)
  components: Record<string, RFComponent>
  addComponent: (component: RFComponent) => void
  updateComponent: (id: string, updates: Partial<RFComponent>) => void
  deleteComponent: (id: string) => void
  clearLibrary: () => void

  // Chain — ordered array of node IDs (persisted)
  chain: string[]
  addToChain: (componentId: string, atIndex?: number, position?: { x: number; y: number }) => void
  removeFromChain: (index: number) => void
  reorderChain: (fromIndex: number, toIndex: number) => void
  clearChain: () => void

  // Free-placement positions (persisted)
  nodePositions: Record<string, { x: number; y: number }>
  updateNodePosition: (id: string, pos: { x: number; y: number }) => void

  // Manual wire connections (persisted)
  rfEdges: RfEdge[]
  addRfEdge: (edge: RfEdge) => void
  removeRfEdge: (id: string) => void
  clearRfEdges: () => void

  // System parameters (persisted)
  systemParams: SystemParams
  setSystemParams: (params: Partial<SystemParams>) => void

  // Cascade result (not persisted)
  cascadeResult: CascadeResult | null
  setCascadeResult: (result: CascadeResult | null) => void

  // S2P data (not persisted)
  s2pData: Record<string, S2PFile>
  setS2P: (componentId: string, data: S2PFile) => void
  clearS2P: (componentId: string) => void

  // Presets (persisted)
  presets: Record<string, Preset>
  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void

  // UI state (not persisted)
  isExtracting: boolean
  extractionError: string | null
  calcError: string | null
  chainClearedAt: number
  libraryFocusedAt: number       // bumped to auto-switch sidebar to My Library tab
  setExtracting: (value: boolean) => void
  setExtractionError: (error: string | null) => void
  setCalcError: (error: string | null) => void
  focusLibrary: () => void
}

export const useSpectraStore = create<SpectraStore>()(
  persist(
    (set) => ({
      // ── Components ─────────────────────────────────────────────────────────
      components: {},
      addComponent: (component) =>
        set((state) => ({ components: { ...state.components, [component.id]: component } })),
      updateComponent: (id, updates) =>
        set((state) => ({
          components: { ...state.components, [id]: { ...state.components[id], ...updates } },
        })),
      deleteComponent: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.components
          return { components: rest }
        }),
      clearLibrary: () =>
        set((state) => {
          const kept = Object.fromEntries(
            Object.entries(state.components).filter(([id]) => id.includes('__'))
          )
          return { components: kept }
        }),

      // ── Chain ───────────────────────────────────────────────────────────────
      chain: [],
      addToChain: (componentId, atIndex, position) =>
        set((state) => {
          const entryId = `${componentId}__${Date.now()}_${Math.random().toString(36).slice(2)}`
          const newChain = [...state.chain]
          if (atIndex !== undefined) {
            newChain.splice(atIndex, 0, entryId)
          } else {
            newChain.push(entryId)
          }
          const source = state.components[componentId]
          const newComponents = source
            ? { ...state.components, [entryId]: { ...source, id: entryId } }
            : state.components

          // Position: use provided position, or place to the right of existing nodes
          const autoPos = position ?? {
            x: state.chain.length * (NODE_W + NODE_GAP),
            y: 80,
          }
          const newPositions = { ...state.nodePositions, [entryId]: autoPos }

          return { chain: newChain, components: newComponents, nodePositions: newPositions }
        }),
      removeFromChain: (index) =>
        set((state) => {
          const id = state.chain[index]
          const newChain = [...state.chain]
          newChain.splice(index, 1)
          // Remove associated edges
          const newEdges = state.rfEdges.filter((e) => e.source !== id && e.target !== id)
          // Remove position
          const { [id]: _pos, ...restPos } = state.nodePositions
          return { chain: newChain, rfEdges: newEdges, nodePositions: restPos }
        }),
      reorderChain: (fromIndex, toIndex) =>
        set((state) => {
          const newChain = [...state.chain]
          const [moved] = newChain.splice(fromIndex, 1)
          newChain.splice(toIndex, 0, moved)
          return { chain: newChain }
        }),
      clearChain: () =>
        set({ chain: [], rfEdges: [], nodePositions: {}, chainClearedAt: Date.now() }),

      // ── Positions ──────────────────────────────────────────────────────────
      nodePositions: {},
      updateNodePosition: (id, pos) =>
        set((state) => ({ nodePositions: { ...state.nodePositions, [id]: pos } })),

      // ── Edges ──────────────────────────────────────────────────────────────
      rfEdges: [],
      addRfEdge: (edge) =>
        set((state) => {
          // Prevent duplicate connections on same source→target
          const exists = state.rfEdges.some(
            (e) => e.source === edge.source && e.target === edge.target
          )
          if (exists) return {}
          return { rfEdges: [...state.rfEdges, edge] }
        }),
      removeRfEdge: (id) =>
        set((state) => ({ rfEdges: state.rfEdges.filter((e) => e.id !== id) })),
      clearRfEdges: () => set({ rfEdges: [] }),

      // ── S2P ────────────────────────────────────────────────────────────────
      s2pData: {},
      setS2P: (componentId, data) =>
        set((state) => ({ s2pData: { ...state.s2pData, [componentId]: data } })),
      clearS2P: (componentId) =>
        set((state) => {
          const { [componentId]: _, ...rest } = state.s2pData
          return { s2pData: rest }
        }),

      // ── Presets ────────────────────────────────────────────────────────────
      presets: {},
      savePreset: (name) =>
        set((state) => {
          const snapshot: PresetSnapshot | undefined = state.cascadeResult
            ? {
                cascaded_nf_db:    state.cascadeResult.cascaded_nf_db,
                total_gain_db:     state.cascadeResult.total_gain_db,
                cascaded_iip3_dbm: state.cascadeResult.cascaded_iip3_dbm ?? null,
                sensitivity_dbm:   state.cascadeResult.sensitivity_dbm,
              }
            : undefined
          return {
            presets: {
              ...state.presets,
              [name]: {
                name,
                chain: [...state.chain],
                components: { ...state.components },
                systemParams: { ...state.systemParams },
                snapshot,
                savedAt: Date.now(),
              },
            },
          }
        }),
      loadPreset: (name) =>
        set((state) => {
          const preset = state.presets[name]
          if (!preset) return {}
          // Restore positions from preset chain order
          const positions: Record<string, { x: number; y: number }> = {}
          preset.chain.forEach((id, i) => { positions[id] = { x: i * (NODE_W + NODE_GAP), y: 80 } })
          return {
            chain: [...preset.chain],
            components: { ...preset.components },
            nodePositions: positions,
            rfEdges: [],
            ...(preset.systemParams ? { systemParams: { ...preset.systemParams } } : {}),
          }
        }),
      deletePreset: (name) =>
        set((state) => {
          const { [name]: _, ...rest } = state.presets
          return { presets: rest }
        }),

      // ── System params ──────────────────────────────────────────────────────
      systemParams: { bandwidth_hz: 20_000_000, temperature_k: 290, frequency_ghz: 2.4 },
      setSystemParams: (params) =>
        set((state) => ({ systemParams: { ...state.systemParams, ...params } })),

      // ── Cascade ────────────────────────────────────────────────────────────
      cascadeResult: null,
      setCascadeResult: (result) => set({ cascadeResult: result }),

      // ── UI ─────────────────────────────────────────────────────────────────
      isExtracting: false,
      extractionError: null,
      calcError: null,
      chainClearedAt: 0,
      libraryFocusedAt: 0,
      setExtracting: (value) => set({ isExtracting: value }),
      setExtractionError: (error) => set({ extractionError: error }),
      setCalcError: (error) => set({ calcError: error }),
      focusLibrary: () => set((s) => ({ libraryFocusedAt: s.libraryFocusedAt + 1 })),
    }),
    {
      name: 'spectra-v1',
      partialize: (state) => ({
        components:    state.components,
        chain:         state.chain,
        nodePositions: state.nodePositions,
        rfEdges:       state.rfEdges,
        systemParams:  state.systemParams,
        presets:       state.presets,
      }),
    },
  ),
)
