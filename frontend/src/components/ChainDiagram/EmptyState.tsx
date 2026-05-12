/**
 * EmptyState
 *
 * Shown in the chain canvas when no components are in the chain.
 * Guides new users through the 3-step workflow and offers a
 * one-click "Load Example" chain so they can explore immediately.
 */

import { useSpectraStore } from '../../store/useSpectraStore'
import type { RFComponent } from '../../types'

// A minimal example LNA→Amp→Filter chain
const EXAMPLE_COMPONENTS: RFComponent[] = [
  { id: 'ex-lna',  name: 'Input LNA',  type: 'LNA',       gain_db: 18,  nf_db: 1.2, iip3_dbm: -5,  p1db_dbm: -15 },
  { id: 'ex-amp',  name: 'Driver Amp', type: 'Amplifier', gain_db: 14,  nf_db: 3.5, iip3_dbm: 10,  p1db_dbm: 0   },
  { id: 'ex-filt', name: 'IF Filter',  type: 'Filter',    gain_db: -3,  nf_db: 3.0, iip3_dbm: 20,  p1db_dbm: 10  },
  { id: 'ex-amp2', name: 'Output Amp', type: 'Amplifier', gain_db: 20,  nf_db: 4.0, iip3_dbm: 15,  p1db_dbm: 5   },
]

const STEPS = [
  {
    icon: '⊞',
    color: 'text-violet-400',
    borderColor: 'border-violet-800/60',
    bgColor: 'bg-violet-900/20',
    title: 'Build your library',
    desc: 'Add LNAs, amplifiers, filters and mixers in the left panel — or paste a datasheet to auto-extract specs.',
  },
  {
    icon: '→',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-800/60',
    bgColor: 'bg-emerald-900/20',
    title: 'Assemble the chain',
    desc: 'Click a component\'s "+ Chain" button to append it here. Drag nodes to reorder. Double-click to edit inline.',
  },
  {
    icon: '◈',
    color: 'text-amber-400',
    borderColor: 'border-amber-800/60',
    bgColor: 'bg-amber-900/20',
    title: 'Read the results',
    desc: 'Cascaded NF, gain, IIP3, and sensitivity update live on the right. Export a PDF report when you\'re ready.',
  },
]

export function EmptyState() {
  const addComponent  = useSpectraStore((s) => s.addComponent)
  const addToChain    = useSpectraStore((s) => s.addToChain)
  const clearChain    = useSpectraStore((s) => s.clearChain)

  function loadExample() {
    clearChain()
    for (const comp of EXAMPLE_COMPONENTS) {
      addComponent(comp)
      addToChain(comp.id)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10 select-none">
      {/* Logo / headline */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3 text-violet-500 opacity-80">◈</div>
        <h2 className="text-lg font-semibold text-gray-200 tracking-tight">Welcome to Spectra</h2>
        <p className="text-sm text-gray-500 mt-1">RF cascade calculator · three steps to get started</p>
      </div>

      {/* Step cards */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-2xl mb-8">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`rounded-xl border ${step.borderColor} ${step.bgColor} p-4 flex flex-col gap-2`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${step.color}`}>{step.icon}</span>
              <span className="text-[10px] text-gray-600 font-mono">STEP {i + 1}</span>
            </div>
            <p className="text-xs font-medium text-gray-200">{step.title}</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={loadExample}
          className="px-5 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-violet-900/30"
        >
          Load Example Chain
        </button>
        <p className="text-[10px] text-gray-700">
          LNA → Driver Amp → IF Filter → Output Amp
        </p>
      </div>
    </div>
  )
}
