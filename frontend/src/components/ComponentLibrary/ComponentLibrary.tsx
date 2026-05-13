import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSpectraStore } from '../../store/useSpectraStore'
import { ParameterBadge } from '../shared/ParameterBadge'
import { MyLibrary } from './MyLibrary'
import { COMPONENT_CATALOG } from '../../data/componentCatalog'
import type { RFComponent } from '../../types'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', PA: '🔊', VGA: '↕', Limiter: '⌇',
  BPF: '≋', LPF: '⊏', HPF: '⊐', BSF: '⊓', Diplexer: '⑂',
  Attenuator: '▼', Splitter: '⑃', Coupler: '⊕', Circulator: '↻', Isolator: '⇒',
  Mixer: '×', Generic: '□',
}

type Tab = 'library' | 'catalog'

// ─── Catalog tab ──────────────────────────────────────────────────────────────
function CatalogBrowser() {
  const addComponent = useSpectraStore((s) => s.addComponent)
  const addToChain = useSpectraStore((s) => s.addToChain)
  const [activeType, setActiveType] = useState(COMPONENT_CATALOG[0].type)
  const [search, setSearch] = useState('')
  const [added, setAdded] = useState<Record<string, boolean>>({})

  const query = search.trim().toLowerCase()

  // When searching, show across all types; otherwise show active type
  const visibleItems = query
    ? COMPONENT_CATALOG.flatMap((sec) =>
        sec.components
          .filter((c) => c.name.toLowerCase().includes(query))
          .map((c) => ({ ...c, type: sec.type }))
      )
    : (COMPONENT_CATALOG.find((s) => s.type === activeType)?.components ?? [])

  function handleAdd(entry: Omit<RFComponent, 'id' | 'source'>) {
    const id = uuidv4()
    const component: RFComponent = { ...entry, id, source: 'manual' }
    addComponent(component)
    addToChain(id)
    setAdded((prev) => ({ ...prev, [entry.name]: true }))
    setTimeout(() => setAdded((prev) => ({ ...prev, [entry.name]: false })), 1500)
  }

  return (
    <div>
      {/* Search box */}
      <div className="px-2 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components…"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Type tabs — hidden while searching */}
      {!query && (
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
          {COMPONENT_CATALOG.map((sec) => (
            <button
              key={sec.type}
              onClick={() => setActiveType(sec.type)}
              className={`shrink-0 px-2 py-1 text-[10px] rounded transition-colors ${
                activeType === sec.type
                  ? 'bg-violet-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {TYPE_ICON[sec.type]} {sec.type}
            </button>
          ))}
        </div>
      )}

      {/* Component list */}
      {visibleItems.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-600">No components found</p>
      )}
      <ul className="px-2 space-y-1">
        {visibleItems.map((comp) => (
          <li
            key={comp.name}
            className="flex items-center gap-2 rounded p-2 hover:bg-gray-800 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 truncate font-medium">{comp.name}</p>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                <ParameterBadge label="G" value={comp.gain_db} />
                <ParameterBadge label="NF" value={comp.nf_db} positiveIsGood={false} />
                <ParameterBadge label="IIP3" value={comp.iip3_dbm ?? null} unit="dBm" />
              </div>
            </div>
            <button
              onClick={() => handleAdd(comp)}
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded transition-all ${
                added[comp.name]
                  ? 'bg-emerald-700 text-white'
                  : 'text-violet-400 hover:text-white hover:bg-violet-700 opacity-0 group-hover:opacity-100'
              }`}
            >
              {added[comp.name] ? '✓' : '+ Chain'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ComponentLibrary() {
  const [tab, setTab] = useState<Tab>('catalog')
  const components       = useSpectraStore((s) => s.components)
  const libraryFocusedAt = useSpectraStore((s) => s.libraryFocusedAt)

  // Auto-switch to My Library when a component is saved from the upload panel
  useEffect(() => {
    if (libraryFocusedAt > 0) setTab('library')
  }, [libraryFocusedAt])

  const libraryCount = Object.values(components).filter((c) => !c.id.includes('__')).length

  return (
    <div>
      {/* Header + tabs */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Components
        </span>
        <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
          <button
            onClick={() => setTab('catalog')}
            className={`px-2 py-1 transition-colors ${
              tab === 'catalog' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Catalog
          </button>
          <button
            onClick={() => setTab('library')}
            className={`px-2 py-1 transition-colors ${
              tab === 'library' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            My Library
            {libraryCount > 0 && (
              <span className="ml-1 bg-violet-700/70 text-violet-200 rounded px-1 text-[8px] font-mono">
                {libraryCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === 'catalog' ? <CatalogBrowser /> : <MyLibrary />}
    </div>
  )
}
