import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CascadeResult, RFComponent, SystemParams } from '../types'

interface SpectraStore {
  // Component library (session-scoped, persisted)
  components: Record<string, RFComponent>
  addComponent: (component: RFComponent) => void
  updateComponent: (id: string, updates: Partial<RFComponent>) => void

  // Chain — ordered array of component IDs (persisted)
  chain: string[]
  addToChain: (componentId: string, atIndex?: number) => void
  removeFromChain: (index: number) => void
  reorderChain: (fromIndex: number, toIndex: number) => void

  // System parameters (persisted)
  systemParams: SystemParams
  setSystemParams: (params: Partial<SystemParams>) => void

  // Cascade result (not persisted — recalculated on load)
  cascadeResult: CascadeResult | null
  setCascadeResult: (result: CascadeResult | null) => void

  // UI state (not persisted)
  isExtracting: boolean
  extractionError: string | null
  setExtracting: (value: boolean) => void
  setExtractionError: (error: string | null) => void
}

export const useSpectraStore = create<SpectraStore>()(
  persist(
    (set) => ({
      components: {},
      addComponent: (component) =>
        set((state) => ({
          components: { ...state.components, [component.id]: component },
        })),
      updateComponent: (id, updates) =>
        set((state) => ({
          components: {
            ...state.components,
            [id]: { ...state.components[id], ...updates },
          },
        })),

      chain: [],
      addToChain: (componentId, atIndex) =>
        set((state) => {
          // Each chain entry gets a unique instance id so the same component
          // can appear multiple times (e.g. two identical LNA stages)
          const entryId = `${componentId}__${Date.now()}_${Math.random().toString(36).slice(2)}`
          const newChain = [...state.chain]
          if (atIndex !== undefined) {
            newChain.splice(atIndex, 0, entryId)
          } else {
            newChain.push(entryId)
          }
          // Also clone the component with the new entry id so it's independently editable
          const source = state.components[componentId]
          const newComponents = source
            ? { ...state.components, [entryId]: { ...source, id: entryId } }
            : state.components
          return { chain: newChain, components: newComponents }
        }),
      removeFromChain: (index) =>
        set((state) => {
          const newChain = [...state.chain]
          newChain.splice(index, 1)
          return { chain: newChain }
        }),
      reorderChain: (fromIndex, toIndex) =>
        set((state) => {
          const newChain = [...state.chain]
          const [moved] = newChain.splice(fromIndex, 1)
          newChain.splice(toIndex, 0, moved)
          return { chain: newChain }
        }),

      systemParams: { bandwidth_hz: 20_000_000, temperature_k: 290 },
      setSystemParams: (params) =>
        set((state) => ({
          systemParams: { ...state.systemParams, ...params },
        })),

      cascadeResult: null,
      setCascadeResult: (result) => set({ cascadeResult: result }),

      isExtracting: false,
      extractionError: null,
      setExtracting: (value) => set({ isExtracting: value }),
      setExtractionError: (error) => set({ extractionError: error }),
    }),
    {
      name: 'spectra-v1',
      partialize: (state) => ({
        components: state.components,
        chain: state.chain,
        systemParams: state.systemParams,
      }),
    },
  ),
)
