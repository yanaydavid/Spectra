import { useRef, useState, useEffect, type ReactElement } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useSpectraStore } from '../../store/useSpectraStore'
import { parseS2P } from '../../utils/parseS2P'
import type { ComponentType } from '../../types'

const ALL_TYPES: ComponentType[] = [
  'LNA','Amplifier','PA','VGA','Limiter',
  'BPF','LPF','HPF','BSF','Diplexer',
  'Attenuator','Splitter','Coupler','Circulator','Isolator','Termination',
  'PhaseShifter','Hybrid90','Hybrid180','Balun',
  'Mixer','UpConverter','Multiplier','Divider',
  'VCO','VCXO','PLL','CrystalOsc',
  'Switch','TRSwitch',
  'ADC','DAC',
  'Antenna','Generic',
]

const ROTATION_HANDLES: Record<number, [Position, Position]> = {
  0:   [Position.Left,   Position.Right],
  90:  [Position.Top,    Position.Bottom],
  180: [Position.Right,  Position.Left],
  270: [Position.Bottom, Position.Top],
}

// Component types that have a third LO port at the bottom
const HAS_LO_PORT = new Set<string>(['Mixer', 'UpConverter'])

// ── SVG schematic symbols ────────────────────────────────────────────────────
const S = '#a78bfa'        // violet-400
const F = 'rgba(109,40,217,0.12)'

// SVG_CY: vertical center of the connector lines within the symbol viewBox (y=22 out of 44)
// Used to align ReactFlow handles with the connector line midpoint
export const SVG_CY = 22          // px from top of SVG
export const SVG_PADDING_TOP = 4  // paddingTop on the flex container

function SchematicSymbol({ type }: { type: string }) {
  const map: Partial<Record<string, ReactElement>> = {
    LNA: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="10" y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="10,5 10,39 54,22" stroke={S} strokeWidth="2" strokeLinejoin="round" fill={F}/>
        <line x1="54" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="20" y="26" fontSize="8" fill={S} fontFamily="monospace" fontWeight="bold">LNA</text>
      </svg>
    ),
    Amplifier: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="10" y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="10,5 10,39 54,22" stroke={S} strokeWidth="2" strokeLinejoin="round" fill={F}/>
        <line x1="54" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
      </svg>
    ),
    PA: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="8"  y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="8,4 8,40 56,22" stroke={S} strokeWidth="2.5" strokeLinejoin="round" fill={F}/>
        <line x1="56" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="21" y="27" fontSize="10" fill={S} fontFamily="monospace" fontWeight="bold">PA</text>
      </svg>
    ),
    VGA: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="10" y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="10,5 10,39 54,22" stroke={S} strokeWidth="2" strokeLinejoin="round" fill={F}/>
        <line x1="54" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="19" y="27" fontSize="9" fill={S} fontFamily="monospace">VGA</text>
        <line x1="28" y1="13" x2="28" y2="31" stroke={S} strokeWidth="1" strokeDasharray="2,2"/>
      </svg>
    ),
    Limiter: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M18,28 L22,28 L22,16 L30,16 L30,28 L34,28 L34,16 L42,16 L42,28 L46,28" stroke={S} strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    BPF: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M18,30 L22,30 L24,14 L28,14 L30,30 L34,30 L36,14 L40,14 L42,30 L46,30" stroke={S} strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    LPF: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M18,30 L18,15 L30,15 L34,30 L46,30" stroke={S} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
    HPF: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M18,30 L30,30 L34,15 L46,15 L46,30" stroke={S} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
    BSF: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M18,15 L22,15 L24,30 L28,15 L36,15 L40,30 L42,15 L46,15" stroke={S} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      </svg>
    ),
    Diplexer: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="6" width="40" height="32" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="14" x2="64" y2="14" stroke={S} strokeWidth="2"/>
        <line x1="52" y1="30" x2="64" y2="30" stroke={S} strokeWidth="2"/>
        <line x1="32" y1="6"  x2="32" y2="14" stroke={S} strokeWidth="1"/>
        <line x1="32" y1="22" x2="32" y2="30" stroke={S} strokeWidth="1"/>
        <text x="22" y="25" fontSize="7" fill={S} fontFamily="monospace">DIPLEX</text>
      </svg>
    ),
    Attenuator: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="14" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="14" y="10" width="36" height="24" rx="2" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="50" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <line x1="22" y1="10" x2="22" y2="34" stroke={S} strokeWidth="1.5"/>
        <line x1="42" y1="10" x2="42" y2="34" stroke={S} strokeWidth="1.5"/>
        <line x1="22" y1="22" x2="42" y2="22" stroke={S} strokeWidth="1.5"/>
        <line x1="32" y1="10" x2="32" y2="22" stroke={S} strokeWidth="1.5"/>
      </svg>
    ),
    Splitter: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="22" y2="22" stroke={S} strokeWidth="2"/>
        <circle cx="22" cy="22" r="3" fill={S}/>
        <line x1="22" y1="22" x2="50" y2="10" stroke={S} strokeWidth="2"/>
        <line x1="22" y1="22" x2="50" y2="34" stroke={S} strokeWidth="2"/>
        <line x1="50" y1="10" x2="64" y2="10" stroke={S} strokeWidth="2"/>
        <line x1="50" y1="34" x2="64" y2="34" stroke={S} strokeWidth="2"/>
      </svg>
    ),
    Coupler: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="16" x2="64" y2="16" stroke={S} strokeWidth="2"/>
        <line x1="0"  y1="28" x2="64" y2="28" stroke={S} strokeWidth="1.5" strokeDasharray="4,3"/>
        <rect x="16" y="10" width="32" height="24" rx="2" stroke={S} strokeWidth="1.5" fill={F}/>
        <text x="22" y="25" fontSize="8" fill={S} fontFamily="monospace">COUP</text>
      </svg>
    ),
    Circulator: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="14" y2="22" stroke={S} strokeWidth="2"/>
        <circle cx="32" cy="22" r="16" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="48" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M22,16 A12,12 0 1 1 42,16" stroke={S} strokeWidth="1.5" fill="none"/>
        <polygon points="38,10 44,16 36,16" fill={S}/>
      </svg>
    ),
    Isolator: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <line x1="20" y1="22" x2="38" y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="34,17 42,22 34,27" fill={S}/>
        <line x1="44" y1="15" x2="44" y2="29" stroke={S} strokeWidth="2"/>
      </svg>
    ),
    Termination: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="28" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="28" y="12" width="24" height="20" rx="2" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="36" y1="16" x2="44" y2="28" stroke={S} strokeWidth="1.5"/>
        <line x1="44" y1="16" x2="36" y2="28" stroke={S} strokeWidth="1.5"/>
      </svg>
    ),
    PhaseShifter: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="24" y="31" fontSize="20" fill={S} fontFamily="serif">φ</text>
      </svg>
    ),
    Hybrid90: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="17" y="28" fontSize="11" fill={S} fontFamily="monospace">90°</text>
      </svg>
    ),
    Hybrid180: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="13" y="28" fontSize="10" fill={S} fontFamily="monospace">180°</text>
      </svg>
    ),
    Balun: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M16,22 Q18,15 20,22 Q22,29 24,22 Q26,15 28,22" stroke={S} strokeWidth="1.5" fill="none"/>
        <line x1="32" y1="8"  x2="32" y2="36" stroke={S} strokeWidth="1.5"/>
        <path d="M36,22 Q38,15 40,22 Q42,29 44,22 Q46,15 48,22" stroke={S} strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    Mixer: (
      <svg viewBox="0 0 64 52" fill="none">
        {/* RF → left */}
        <line x1="0"  y1="22" x2="14" y2="22" stroke={S} strokeWidth="2"/>
        <text x="1" y="19" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">RF</text>
        {/* Circle */}
        <circle cx="32" cy="22" r="16" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="22" y1="12" x2="42" y2="32" stroke={S} strokeWidth="2"/>
        <line x1="42" y1="12" x2="22" y2="32" stroke={S} strokeWidth="2"/>
        {/* IF → right */}
        <line x1="48" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="48" y="19" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">IF</text>
        {/* LO ↓ bottom */}
        <line x1="32" y1="38" x2="32" y2="52" stroke={S} strokeWidth="2"/>
        <text x="34" y="51" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">LO</text>
      </svg>
    ),
    UpConverter: (
      <svg viewBox="0 0 64 52" fill="none">
        {/* RF → left */}
        <line x1="0"  y1="22" x2="14" y2="22" stroke={S} strokeWidth="2"/>
        <text x="1" y="19" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">RF</text>
        {/* Circle */}
        <circle cx="32" cy="22" r="16" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="22" y1="12" x2="42" y2="32" stroke={S} strokeWidth="2"/>
        <line x1="42" y1="12" x2="22" y2="32" stroke={S} strokeWidth="2"/>
        {/* IF → right (up-converted) */}
        <line x1="48" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="48" y="19" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">IF</text>
        <polygon points="44,17 48,22 44,27" fill={S}/>
        {/* LO ↓ bottom */}
        <line x1="32" y1="38" x2="32" y2="52" stroke={S} strokeWidth="2"/>
        <text x="34" y="51" fontSize="6" fill={S} fontFamily="monospace" opacity="0.7">LO</text>
      </svg>
    ),
    Multiplier: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="20" y="29" fontSize="13" fill={S} fontFamily="monospace">×n</text>
      </svg>
    ),
    Divider: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="20" y="29" fontSize="13" fill={S} fontFamily="monospace">÷n</text>
      </svg>
    ),
    VCO: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M16,22 Q20,12 26,22 Q32,32 38,22 Q44,12 48,22" stroke={S} strokeWidth="1.5" fill="none"/>
      </svg>
    ),
    VCXO: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <path d="M16,22 Q19,14 22,22 Q25,30 28,22 Q31,14 34,22" stroke={S} strokeWidth="1.5" fill="none"/>
        <line x1="40" y1="12" x2="40" y2="32" stroke={S} strokeWidth="1.5"/>
        <line x1="44" y1="12" x2="44" y2="32" stroke={S} strokeWidth="1.5"/>
      </svg>
    ),
    PLL: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="18" y="28" fontSize="11" fill={S} fontFamily="monospace">PLL</text>
      </svg>
    ),
    CrystalOsc: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="18" y2="22" stroke={S} strokeWidth="2"/>
        <line x1="18" y1="10" x2="18" y2="34" stroke={S} strokeWidth="2"/>
        <rect x="22" y="12" width="20" height="20" rx="1" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="42" y1="10" x2="42" y2="34" stroke={S} strokeWidth="2"/>
        <line x1="42" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
      </svg>
    ),
    Switch: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="18" y2="22" stroke={S} strokeWidth="2"/>
        <circle cx="18" cy="22" r="2.5" fill={S}/>
        <line x1="20" y1="22" x2="40" y2="14" stroke={S} strokeWidth="2"/>
        <circle cx="40" cy="14" r="2.5" stroke={S} strokeWidth="1.5" fill="none"/>
        <circle cx="40" cy="30" r="2.5" stroke={S} strokeWidth="1.5" fill="none"/>
        <line x1="42" y1="14" x2="64" y2="14" stroke={S} strokeWidth="2"/>
        <line x1="42" y1="30" x2="64" y2="30" stroke={S} strokeWidth="2"/>
      </svg>
    ),
    TRSwitch: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
        <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="18" y="27" fontSize="10" fill={S} fontFamily="monospace">T/R</text>
      </svg>
    ),
    ADC: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="8"  y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="8,6 50,6 58,22 50,38 8,38" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="58" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="14" y="28" fontSize="10" fill={S} fontFamily="monospace">ADC</text>
      </svg>
    ),
    DAC: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="0"  y1="22" x2="6"  y2="22" stroke={S} strokeWidth="2"/>
        <polygon points="56,6 14,6 6,22 14,38 56,38" stroke={S} strokeWidth="2" fill={F}/>
        <line x1="56" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
        <text x="18" y="28" fontSize="10" fill={S} fontFamily="monospace">DAC</text>
      </svg>
    ),
    Antenna: (
      <svg viewBox="0 0 64 44" fill="none">
        <line x1="32" y1="40" x2="32" y2="24" stroke={S} strokeWidth="2"/>
        <line x1="20" y1="40" x2="44" y2="40" stroke={S} strokeWidth="2"/>
        <line x1="32" y1="24" x2="14" y2="8"  stroke={S} strokeWidth="2"/>
        <line x1="32" y1="24" x2="50" y2="8"  stroke={S} strokeWidth="2"/>
        <line x1="32" y1="24" x2="20" y2="12" stroke={S} strokeWidth="1.5"/>
        <line x1="32" y1="24" x2="44" y2="12" stroke={S} strokeWidth="1.5"/>
        <line x1="32" y1="24" x2="32" y2="6"  stroke={S} strokeWidth="1.5"/>
      </svg>
    ),
  }

  // Dynamic fallback — works for Generic AND any unrecognized type
  // Shows the type abbreviation inside a box symbol
  const abbrev = type.length <= 3 ? type : type.replace(/[aeiou]/gi, '').substring(0, 4)
  const fontSize = abbrev.length <= 3 ? 12 : abbrev.length <= 5 ? 9 : 8
  const fallback = (
    <svg viewBox="0 0 64 44" fill="none" width="100%" height="100%">
      <line x1="0"  y1="22" x2="12" y2="22" stroke={S} strokeWidth="2"/>
      <rect x="12" y="8" width="40" height="28" rx="3" stroke={S} strokeWidth="2" fill={F}/>
      <line x1="52" y1="22" x2="64" y2="22" stroke={S} strokeWidth="2"/>
      <text x="32" y="26" fontSize={fontSize} fill={S} fontFamily="monospace"
            textAnchor="middle" dominantBaseline="middle">{abbrev}</text>
    </svg>
  )

  const symbol = map[type]
  if (!symbol) return <>{fallback}</>

  // Clone the symbol's SVG with explicit width/height so it fills its container
  return <>{symbol}</>
}

// ── NumInput ──────────────────────────────────────────────────────────────────
function NumInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      step="0.1"
      defaultValue={value ?? ''}
      onBlur={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
    />
  )
}

// ── Node ──────────────────────────────────────────────────────────────────────
interface NodeData { componentId: string; chainIndex: number }

export function ComponentNode({ data }: { data: NodeData }) {
  const component      = useSpectraStore((s) => s.components[data.componentId])
  const removeFromChain = useSpectraStore((s) => s.removeFromChain)
  const updateComponent = useSpectraStore((s) => s.updateComponent)
  const addToChain     = useSpectraStore((s) => s.addToChain)
  const setS2P         = useSpectraStore((s) => s.setS2P)
  const clearS2P       = useSpectraStore((s) => s.clearS2P)
  const hasS2P         = useSpectraStore((s) => !!s.s2pData[data.componentId])

  const [showEditor, setShowEditor] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const rotation = (component?.rotation ?? 0) as 0 | 90 | 180 | 270
  const [targetPos, sourcePos] = ROTATION_HANDLES[rotation]

  useEffect(() => {
    if (!showEditor) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowEditor(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showEditor])

  function handleS2PFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try { setS2P(data.componentId, parseS2P(ev.target?.result as string, file.name)) }
      catch { alert('Failed to parse .s2p file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function rotate(dir: 1 | -1) {
    const steps: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270]
    const next = steps[(steps.indexOf(rotation) + dir + 4) % 4]
    updateComponent(component.id, { rotation: next })
  }

  if (!component) return null

  // Only override 'top' when handles are on Left/Right — for Top/Bottom (rotated) use ReactFlow defaults
  const isHorizontal = targetPos === Position.Left || targetPos === Position.Right
  const handleAlignStyle = isHorizontal ? { top: SVG_PADDING_TOP + SVG_CY } : {}

  return (
    <div className="relative group" style={{ width: 64 }}>
      <Handle
        type="target"
        id="rf"
        position={targetPos}
        style={handleAlignStyle}
        className="!w-2.5 !h-2.5 !bg-gray-600 !border-gray-500 hover:!bg-violet-500 transition-colors"
      />

      {/* LO port — only for Mixer / UpConverter */}
      {HAS_LO_PORT.has(component.type) && (
        <Handle
          type="target"
          id="lo"
          position={Position.Bottom}
          title="LO"
          className="!w-2.5 !h-2.5 !bg-violet-800 !border-violet-600 hover:!bg-violet-400 transition-colors"
          style={{
            left: '50%',
            top: 52,          // SVG height = 52px (LO line reaches y=52 in viewBox)
            bottom: 'auto',
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {/* ── Hover controls ── */}
      <button
        onClick={() => removeFromChain(data.chainIndex)}
        title="Remove"
        className="nodrag absolute -top-3 -right-3 z-10 w-5 h-5 bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow"
      >×</button>

      <button
        onClick={() => addToChain(data.componentId, data.chainIndex + 1)}
        title="Duplicate"
        className="nodrag absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-5 h-5 bg-gray-800 hover:bg-violet-600 text-gray-400 hover:text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow"
      >⧉</button>

      <div className="nodrag absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={() => rotate(-1)} title="Rotate CCW"
          className="w-5 h-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full text-[9px] flex items-center justify-center shadow">↺</button>
        <button onClick={() => rotate(1)}  title="Rotate CW"
          className="w-5 h-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full text-[9px] flex items-center justify-center shadow">↻</button>
      </div>

      {/* ── S2P badge ── */}
      {hasS2P && (
        <span className="absolute -top-1 -left-1 z-10 text-[7px] bg-violet-900 text-violet-300 border border-violet-700 rounded px-0.5 leading-tight pointer-events-none">
          S2P
        </span>
      )}

      {/* ── Main symbol area (draggable — no nodrag) ── */}
      <div
        onClick={() => setShowEditor((v) => !v)}
        className={`w-full flex flex-col items-center rounded-md transition-all cursor-grab active:cursor-grabbing select-none
          ${showEditor
            ? 'ring-1 ring-violet-500 bg-violet-950/30'
            : 'hover:ring-1 hover:ring-violet-700/60 hover:bg-violet-950/20'
          }`}
        style={{ paddingTop: 4, paddingBottom: 4 }}
      >
        {/* SVG symbol — fills full 64px width so handles align with connector lines */}
        <div
          className="[&_svg]:w-full [&_svg]:h-full"
          style={{
            width: '100%',
            height: HAS_LO_PORT.has(component.type) ? 52 : 44,
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          <SchematicSymbol type={component.type} />
        </div>

        {/* Name */}
        <span className="text-[10px] text-gray-300 leading-tight mt-0.5 truncate max-w-[60px] px-1 text-center pointer-events-none">
          {component.name}
        </span>

        {/* Gain · NF */}
        <span className="text-[8px] text-gray-600 font-mono leading-tight pointer-events-none">
          {component.gain_db >= 0 ? '+' : ''}{component.gain_db} · NF {component.nf_db}
        </span>
      </div>

      {/* ── Editor popover ── */}
      {showEditor && (
        <div
          className="nodrag nopan absolute top-0 z-50 w-56 bg-gray-950 border border-violet-700/60 rounded-xl shadow-2xl p-3 flex flex-col gap-2"
          style={{ left: 80 }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wide">
              {component.type}
            </span>
            <button
              onClick={() => setShowEditor(false)}
              className="text-[10px] text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 rounded px-1.5 py-0.5 transition-colors"
            >✕</button>
          </div>

          {/* Name */}
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">Name</span>
            <input
              type="text"
              defaultValue={component.name}
              onBlur={(e) => updateComponent(component.id, { name: e.target.value.trim() || component.name })}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
            />
          </label>

          {/* Type */}
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">Type</span>
            <select
              defaultValue={component.type}
              onChange={(e) => updateComponent(component.id, { type: e.target.value as ComponentType })}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-violet-500"
            >
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {/* Parameters grid */}
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500">Gain (dB)</span>
              <NumInput value={component.gain_db} onChange={(v) => updateComponent(component.id, { gain_db: v as number })}/>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500">NF (dB)</span>
              <NumInput value={component.nf_db}  onChange={(v) => updateComponent(component.id, { nf_db: v as number })}/>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500">IIP3 (dBm)</span>
              <NumInput value={component.iip3_dbm} onChange={(v) => updateComponent(component.id, { iip3_dbm: v })}/>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500">P1dB (dBm)</span>
              <NumInput value={component.p1db_dbm} onChange={(v) => updateComponent(component.id, { p1db_dbm: v })}/>
            </label>
          </div>

          {/* S2P section */}
          <div className="flex items-center gap-1 pt-1 border-t border-gray-800">
            {hasS2P ? (
              <>
                <span className="text-[9px] bg-violet-900/60 text-violet-300 border border-violet-700 rounded px-1 py-0.5 font-mono flex-1">S2P ✓</span>
                <button onClick={() => fileRef.current?.click()} title="Replace" className="text-[9px] text-gray-600 hover:text-violet-400">↻</button>
                <button onClick={() => clearS2P(data.componentId)} title="Remove" className="text-[9px] text-gray-600 hover:text-red-400">✕</button>
              </>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[9px] text-gray-600 hover:text-violet-400 border border-dashed border-gray-700 hover:border-violet-600 rounded px-2 py-0.5 w-full text-center transition-colors"
              >+ Load .s2p</button>
            )}
          </div>

          <input ref={fileRef} type="file" accept=".s2p" className="hidden" onChange={handleS2PFile}/>
        </div>
      )}

      <Handle
        type="source"
        id="out"
        position={sourcePos}
        style={handleAlignStyle}
        className="!w-2.5 !h-2.5 !bg-gray-600 !border-gray-500 hover:!bg-violet-500 transition-colors"
      />
    </div>
  )
}
