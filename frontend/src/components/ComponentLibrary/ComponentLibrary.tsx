import { useSpectraStore } from '../../store/useSpectraStore'
import { ParameterBadge } from '../shared/ParameterBadge'
import { ManualEntryForm } from './ManualEntryForm'

const TYPE_ICON: Record<string, string> = {
  LNA: '⚡', Amplifier: '▲', Attenuator: '▼', Mixer: '×', Filter: '≋', Generic: '□',
}

export function ComponentLibrary() {
  const components = useSpectraStore((s) => s.components)
  const addToChain = useSpectraStore((s) => s.addToChain)

  // Only show "source" components (not chain-entry clones which have __ in id)
  const libraryComponents = Object.values(components).filter((c) => !c.id.includes('__'))

  return (
    <div>
      <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Component Library
      </div>

      {libraryComponents.length === 0 ? (
        <p className="px-4 text-xs text-gray-600 pb-2">
          Upload a datasheet or add manually
        </p>
      ) : (
        <ul className="px-2 space-y-1 pb-2">
          {libraryComponents.map((comp) => (
            <li
              key={comp.id}
              className="flex items-center gap-2 rounded p-2 hover:bg-gray-800 group"
            >
              <span className="text-base shrink-0">{TYPE_ICON[comp.type] ?? '□'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{comp.name}</p>
                <div className="flex gap-2 mt-0.5">
                  <ParameterBadge label="G" value={comp.gain_db} />
                  <ParameterBadge label="NF" value={comp.nf_db} positiveIsGood={false} />
                </div>
              </div>
              <button
                onClick={() => addToChain(comp.id)}
                className="shrink-0 text-xs text-violet-400 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                + Chain
              </button>
            </li>
          ))}
        </ul>
      )}

      <ManualEntryForm />
    </div>
  )
}
