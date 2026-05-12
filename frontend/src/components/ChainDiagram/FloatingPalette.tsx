/**
 * ComponentToolbar — fixed top bar, Genesys-style.
 * Single scrollable row of icons. Category separators. Auto-Wire on the right.
 */

import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import type { ComponentType, RFComponent } from '../../types'

interface CatalogItem {
  type: ComponentType
  icon: string
  label: string
  gain: number
  nf: number
}

const CATALOG: { category: string; items: CatalogItem[] }[] = [
  {
    category: 'Amplifiers',
    items: [
      { type: 'LNA',       icon: '⚡', label: 'LNA',     gain: 15,  nf: 1.5 },
      { type: 'Amplifier', icon: '▶',  label: 'Driver',  gain: 20,  nf: 3   },
      { type: 'PA',        icon: '🔊', label: 'PA',       gain: 10,  nf: 6   },
      { type: 'VGA',       icon: '↕',  label: 'VGA',      gain: 15,  nf: 5   },
      { type: 'Limiter',   icon: '⌇',  label: 'Limiter',  gain: 0,   nf: 3   },
    ],
  },
  {
    category: 'Filters',
    items: [
      { type: 'BPF',      icon: '≋',  label: 'BPF',    gain: -2,  nf: 2  },
      { type: 'LPF',      icon: '⊏',  label: 'LPF',    gain: -1,  nf: 1  },
      { type: 'HPF',      icon: '⊐',  label: 'HPF',    gain: -1,  nf: 1  },
      { type: 'BSF',      icon: '⊓',  label: 'Notch',  gain: -30, nf: 30 },
      { type: 'Diplexer', icon: '⑂',  label: 'Diplex', gain: -1,  nf: 1  },
    ],
  },
  {
    category: 'Passive',
    items: [
      { type: 'Attenuator',  icon: '▼',  label: 'Atten',  gain: -6,  nf: 6  },
      { type: 'Splitter',    icon: '⑃',  label: 'Split',  gain: -3,  nf: 3  },
      { type: 'Coupler',     icon: '⊕',  label: 'Coupl',  gain: -1,  nf: 1  },
      { type: 'Circulator',  icon: '↻',  label: 'Circ',   gain: -1,  nf: 1  },
      { type: 'Isolator',    icon: '⇒',  label: 'Isol',   gain: -1,  nf: 1  },
      { type: 'Termination', icon: '⏚',  label: 'Term',   gain: -30, nf: 30 },
    ],
  },
  {
    category: 'Phase',
    items: [
      { type: 'PhaseShifter', icon: 'φ',    label: 'Φ-Sh',   gain: -1, nf: 1 },
      { type: 'Hybrid90',     icon: '90°',  label: '90°Hyb', gain: -3, nf: 3 },
      { type: 'Hybrid180',    icon: '180°', label: '180°H',  gain: -3, nf: 3 },
      { type: 'Balun',        icon: '∞',    label: 'Balun',  gain: -1, nf: 1 },
    ],
  },
  {
    category: 'Freq. Conv.',
    items: [
      { type: 'Mixer',       icon: '×',  label: 'Mixer',   gain: -8,  nf: 8  },
      { type: 'UpConverter', icon: '↑×', label: 'Up-Conv', gain: -8,  nf: 8  },
      { type: 'Multiplier',  icon: '×n', label: 'Mult',    gain: -10, nf: 10 },
      { type: 'Divider',     icon: '÷n', label: 'Div',     gain: -5,  nf: 5  },
    ],
  },
  {
    category: 'Oscillators',
    items: [
      { type: 'VCO',        icon: '〜', label: 'VCO',  gain: 0, nf: 0 },
      { type: 'VCXO',       icon: '◇',  label: 'VCXO', gain: 0, nf: 0 },
      { type: 'PLL',        icon: '⊗',  label: 'PLL',  gain: 0, nf: 0 },
      { type: 'CrystalOsc', icon: '⬡',  label: 'XTAL', gain: 0, nf: 0 },
    ],
  },
  {
    category: 'Switches',
    items: [
      { type: 'Switch',   icon: '⎋', label: 'SW',  gain: -1, nf: 1 },
      { type: 'TRSwitch', icon: '⇌', label: 'T/R', gain: -1, nf: 1 },
    ],
  },
  {
    category: 'Digital',
    items: [
      { type: 'ADC', icon: '⤒', label: 'ADC', gain: 0,  nf: 10 },
      { type: 'DAC', icon: '⤓', label: 'DAC', gain: 0,  nf: 0  },
    ],
  },
  {
    category: 'Other',
    items: [
      { type: 'Antenna', icon: '📶', label: 'Ant',     gain: 3, nf: 0 },
      { type: 'Generic', icon: '□',  label: 'Generic', gain: 0, nf: 0 },
    ],
  },
]

export function FloatingPalette() {
  const addComponent  = useSpectraStore((s) => s.addComponent)
  const addToChain    = useSpectraStore((s) => s.addToChain)
  const addRfEdge     = useSpectraStore((s) => s.addRfEdge)
  const chain         = useSpectraStore((s) => s.chain)
  const nodePositions = useSpectraStore((s) => s.nodePositions)
  const rfEdges       = useSpectraStore((s) => s.rfEdges)

  function addNew(item: CatalogItem) {
    const id = uuidv4()
    const lastId = chain[chain.length - 1]
    const lastPos = lastId ? (nodePositions[lastId] ?? { x: 0, y: 160 }) : { x: -260, y: 160 }
    const comp: RFComponent = {
      id,
      name: `${item.label} ${chain.length + 1}`,
      type: item.type,
      gain_db: item.gain,
      nf_db: item.nf,
      iip3_dbm: null,
      p1db_dbm: null,
      source: 'manual',
    }
    addComponent(comp)
    addToChain(id, undefined, { x: lastPos.x + 260, y: lastPos.y })
  }

  function autoWire() {
    if (chain.length < 2) return
    const existing = new Set(rfEdges.map((e) => `${e.source}→${e.target}`))
    chain.slice(0, -1).forEach((id, i) => {
      const key = `${id}→${chain[i + 1]}`
      if (!existing.has(key)) {
        addRfEdge({ id: `aw-${id}-${chain[i + 1]}`, source: id, target: chain[i + 1] })
      }
    })
  }

  return (
    <div className="flex items-stretch bg-gray-900 border-b border-gray-800 shrink-0 h-[72px]">
      {/* Scrollable icons area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex items-stretch h-full min-w-max">
          {CATALOG.map(({ category, items }, catIdx) => (
            <div key={category} className="flex items-stretch">
              {/* Category block */}
              <div className="flex flex-col justify-between py-1 px-1">
                {/* Items row */}
                <div className="flex items-center gap-0.5 flex-1">
                  {items.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => addNew(item)}
                      title={`${item.label}  ·  G = ${item.gain} dB  ·  NF = ${item.nf} dB`}
                      className="flex flex-col items-center justify-center gap-1 w-14 h-full rounded-lg hover:bg-violet-900/40 border border-transparent hover:border-violet-700/40 transition-all group"
                    >
                      <span className="text-2xl leading-none group-hover:scale-125 transition-transform duration-150">
                        {item.icon}
                      </span>
                      <span className="text-[11px] text-gray-500 group-hover:text-gray-200 leading-none font-medium">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Category label at the bottom */}
                <span className="text-[9px] text-gray-600 uppercase tracking-widest text-center w-full leading-none pb-0.5 font-medium">
                  {category}
                </span>
              </div>

              {/* Separator */}
              {catIdx < CATALOG.length - 1 && (
                <div className="w-px bg-gray-800 my-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Auto-Wire button — pinned right */}
      {chain.length >= 2 && (
        <div className="flex items-center px-3 border-l border-gray-800 shrink-0">
          <button
            onClick={autoWire}
            className="text-[11px] px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
          >
            ⟶ Auto-Wire
          </button>
        </div>
      )}
    </div>
  )
}
