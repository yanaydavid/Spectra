import { useEffect, useRef, useState } from 'react'
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

type MobileTab = 'library' | 'canvas' | 'results'

export default function App() {
  const chain        = useSpectraStore((s) => s.chain)
  const rfEdges      = useSpectraStore((s) => s.rfEdges)
  const components   = useSpectraStore((s) => s.components)
  const systemParams = useSpectraStore((s) => s.systemParams)
  const setCascadeResult = useSpectraStore((s) => s.setCascadeResult)
  const setCalcError     = useSpectraStore((s) => s.setCalcError)

  const [mobileTab, setMobileTab] = useState<MobileTab>('canvas')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (chain.length === 0) {
      setCascadeResult(null)
      setCalcError(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
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

  // ── Shared panel content ──────────────────────────────────────────────────
  const leftContent = (
    <>
      <UploadPanel />
      <ComponentLibrary />
    </>
  )

  const rightContent = (
    <>
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
    </>
  )

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Desktop: 3-column layout (hidden on mobile) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 flex flex-col border-r border-gray-800 overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              <span className="text-violet-400">◈</span> Spectra
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">RF Chain Calculator</p>
          </div>
          <div className="flex-1 overflow-y-auto">{leftContent}</div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 overflow-hidden">
          <ChainDiagram />
        </main>

        {/* Right results panel */}
        <aside className="w-72 border-l border-gray-800 overflow-y-auto shrink-0">
          {rightContent}
        </aside>
      </div>

      {/* ── Mobile: full-screen tabs + bottom nav ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">

        {/* Mobile header */}
        <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 shrink-0">
          <span className="text-violet-400 text-lg">◈</span>
          <div>
            <h1 className="text-base font-semibold text-white leading-none">Spectra</h1>
            <p className="text-[10px] text-gray-500">RF Chain Calculator</p>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {mobileTab === 'library' && (
            <div>{leftContent}</div>
          )}
          {mobileTab === 'canvas' && (
            <div className="h-full">
              <ChainDiagram />
            </div>
          )}
          {mobileTab === 'results' && (
            <div>{rightContent}</div>
          )}
        </div>

        {/* Bottom navigation */}
        <nav className="shrink-0 flex border-t border-gray-800 bg-gray-900">
          {([
            { id: 'library', icon: '⊞', label: 'Library' },
            { id: 'canvas',  icon: '◫', label: 'Canvas'  },
            { id: 'results', icon: '≡', label: 'Results' },
          ] as { id: MobileTab; icon: string; label: string }[]).map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                mobileTab === id
                  ? 'text-violet-400 border-t-2 border-violet-500 -mt-px'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </div>

    </div>
  )
}
