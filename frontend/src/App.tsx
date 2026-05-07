import { useEffect, useRef } from 'react'
import { useSpectraStore } from './store/useSpectraStore'
import { calculateChain } from './api/calculateChain'
import { UploadPanel } from './components/UploadPanel/UploadPanel'
import { ComponentLibrary } from './components/ComponentLibrary/ComponentLibrary'
import { ChainDiagram } from './components/ChainDiagram/ChainDiagram'
import { ResultsPanel } from './components/ResultsPanel/ResultsPanel'

export default function App() {
  const chain = useSpectraStore((s) => s.chain)
  const components = useSpectraStore((s) => s.components)
  const systemParams = useSpectraStore((s) => s.systemParams)
  const setCascadeResult = useSpectraStore((s) => s.setCascadeResult)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (chain.length === 0) {
      setCascadeResult(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const stages = chain.map((id) => components[id]).filter(Boolean)
      if (stages.length === 0) return
      try {
        const result = await calculateChain({ stages, system_params: systemParams })
        setCascadeResult(result)
      } catch {
        // Keep stale results on error
      }
    }, 50)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [chain, components, systemParams, setCascadeResult])

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-80 flex flex-col border-r border-gray-800 overflow-y-auto shrink-0">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-semibold text-white tracking-tight">
            <span className="text-violet-400">◈</span> Spectra
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">RF Chain Calculator</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <UploadPanel />
          <ComponentLibrary />
        </div>
      </aside>

      {/* Main canvas */}
      <main className="flex-1 overflow-hidden">
        <ChainDiagram />
      </main>

      {/* Right results panel */}
      <aside className="w-72 border-l border-gray-800 overflow-y-auto shrink-0">
        <ResultsPanel />
      </aside>
    </div>
  )
}
