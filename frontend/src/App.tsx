import { useEffect, useRef } from 'react'
import { useSpectraStore, deriveChainOrder } from './store/useSpectraStore'
import { calculateChain } from './api/calculateChain'
import { UploadPanel } from './components/UploadPanel/UploadPanel'
import { ComponentLibrary } from './components/ComponentLibrary/ComponentLibrary'
import { ChainDiagram } from './components/ChainDiagram/ChainDiagram'
import { ResultsPanel } from './components/ResultsPanel/ResultsPanel'
import { MatchingNetworkPanel } from './components/MatchingNetwork/MatchingNetworkPanel'
import { StabilityPanel } from './components/Stability/StabilityPanel'
import { MonteCarloPanel } from './components/MonteCarlo/MonteCarloPanel'
import { FrequencySweepPanel } from './components/FrequencySweep/FrequencySweepPanel'
import { ComparisonPanel } from './components/ChainComparison/ComparisonPanel'
import { S2PViewer } from './components/S2PViewer/S2PViewer'
import { DesignAdvisorPanel } from './components/DesignAdvisor/DesignAdvisorPanel'
import { AutoBuilderPanel } from './components/AutoBuilder/AutoBuilderPanel'
import { SensitivityPanel } from './components/Sensitivity/SensitivityPanel'
import { AIAssistantPanel } from './components/AIAssistant/AIAssistantPanel'

export default function App() {
  const chain        = useSpectraStore((s) => s.chain)
  const rfEdges      = useSpectraStore((s) => s.rfEdges)
  const components   = useSpectraStore((s) => s.components)
  const systemParams = useSpectraStore((s) => s.systemParams)
  const setCascadeResult = useSpectraStore((s) => s.setCascadeResult)
  const setCalcError     = useSpectraStore((s) => s.setCalcError)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (chain.length === 0) {
      setCascadeResult(null)
      setCalcError(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      // Use graph-derived order when connections exist
      const orderedIds = deriveChainOrder(chain, rfEdges)
      const stages = orderedIds.map((id) => components[id]).filter(Boolean)
      if (stages.length === 0) return
      try {
        const result = await calculateChain({ stages, system_params: systemParams })
        setCascadeResult(result)
        setCalcError(null)
      } catch {
        setCalcError('Calculation failed — check backend connection')
      }
    }, 50)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [chain, rfEdges, components, systemParams, setCascadeResult])

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
        <AIAssistantPanel />
        <ResultsPanel />
        <DesignAdvisorPanel />
        <AutoBuilderPanel />
        <SensitivityPanel />
        <MatchingNetworkPanel />
        <StabilityPanel />
        <MonteCarloPanel />
        <FrequencySweepPanel />
        <ComparisonPanel />
        <S2PViewer />
      </aside>
    </div>
  )
}
