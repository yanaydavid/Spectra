import type { Element, NetworkType } from '../../utils/matchingNetwork'

// ── SVG drawing helpers ───────────────────────────────────────────────────────
const WIRE_COLOR = '#9ca3af'
const L_COLOR    = '#34d399'   // green — inductor
const C_COLOR    = '#60a5fa'   // blue  — capacitor
const GND_COLOR  = '#6b7280'

function Wire({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WIRE_COLOR} strokeWidth={1.5} />
}

function GndSymbol({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 8} stroke={GND_COLOR} strokeWidth={1.5} />
      <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y + 8} stroke={GND_COLOR} strokeWidth={1.5} />
      <line x1={x - 5} y1={y + 11} x2={x + 5} y2={y + 11} stroke={GND_COLOR} strokeWidth={1.5} />
      <line x1={x - 2} y1={y + 14} x2={x + 2} y2={y + 14} stroke={GND_COLOR} strokeWidth={1.5} />
    </g>
  )
}

// Inductor: coil symbol (series of arcs)
function InductorSymbol({ cx, cy, horiz = true }: { cx: number; cy: number; horiz?: boolean }) {
  if (horiz) {
    const arcs = [-12, -4, 4, 12].map((dx) =>
      `M ${cx + dx} ${cy} a 4 4 0 0 1 8 0`
    ).join(' ')
    return (
      <g>
        <path d={arcs} fill="none" stroke={L_COLOR} strokeWidth={1.5} />
        <Wire x1={cx - 16} y1={cy} x2={cx - 12} y2={cy} />
        <Wire x1={cx + 20} y1={cy} x2={cx + 16} y2={cy} />
      </g>
    )
  }
  // Vertical
  const arcs = [-12, -4, 4, 12].map((dy) =>
    `M ${cx} ${cy + dy} a 4 4 0 0 0 0 8`
  ).join(' ')
  return (
    <g>
      <path d={arcs} fill="none" stroke={L_COLOR} strokeWidth={1.5} />
      <Wire x1={cx} y1={cy - 16} x2={cx} y2={cy - 12} />
      <Wire x1={cx} y1={cy + 20} x2={cx} y2={cy + 16} />
    </g>
  )
}

// Capacitor: two parallel plates
function CapacitorSymbol({ cx, cy, horiz = true }: { cx: number; cy: number; horiz?: boolean }) {
  if (horiz) {
    return (
      <g>
        <Wire x1={cx - 16} y1={cy} x2={cx - 3} y2={cy} />
        <line x1={cx - 3} y1={cy - 8} x2={cx - 3} y2={cy + 8} stroke={C_COLOR} strokeWidth={2} />
        <line x1={cx + 3} y1={cy - 8} x2={cx + 3} y2={cy + 8} stroke={C_COLOR} strokeWidth={2} />
        <Wire x1={cx + 3} y1={cy} x2={cx + 16} y2={cy} />
      </g>
    )
  }
  return (
    <g>
      <Wire x1={cx} y1={cy - 16} x2={cx} y2={cy - 3} />
      <line x1={cx - 8} y1={cy - 3} x2={cx + 8} y2={cy - 3} stroke={C_COLOR} strokeWidth={2} />
      <line x1={cx - 8} y1={cy + 3} x2={cx + 8} y2={cy + 3} stroke={C_COLOR} strokeWidth={2} />
      <Wire x1={cx} y1={cy + 3} x2={cx} y2={cy + 16} />
    </g>
  )
}

function ComponentSvg({
  el, cx, cy, horiz = true,
}: {
  el: Element; cx: number; cy: number; horiz?: boolean
}) {
  return el.type === 'L'
    ? <InductorSymbol cx={cx} cy={cy} horiz={horiz} />
    : <CapacitorSymbol cx={cx} cy={cy} horiz={horiz} />
}

function ComponentLabel({
  el, x, y,
}: {
  el: Element; x: number; y: number
}) {
  const color = el.type === 'L' ? L_COLOR : C_COLOR
  return (
    <g>
      <text x={x} y={y} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">
        {el.label}
      </text>
      <text x={x} y={y + 10} textAnchor="middle" fontSize={8} fill="#6b7280">
        {el.value} {el.unit}
      </text>
    </g>
  )
}

// Port label (Rs or Rl)
function PortLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={9} fill="#9ca3af">{label}</text>
  )
}

// ── L-network schematic ───────────────────────────────────────────────────────
function LNetworkSvg({ elements }: { elements: Element[] }) {
  if (elements.length !== 2) return null

  const [e1, e2] = elements
  // e1: first element (shunt or series), e2: second element
  const W = 260; const H = 110
  const midY = 48
  const gndY = midY + 30

  // Determine layout: which is series, which is shunt
  const seriesEl = elements.find((e) => e.position === 'series')!
  const shuntEl  = elements.find((e) => e.position === 'shunt')!
  const seriesFirst = e1.position === 'series'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Input wire */}
      <Wire x1={10} y1={midY} x2={60} y2={midY} />
      <PortLabel x={10} y={midY - 8} label="Rs" />

      {seriesFirst ? (
        <>
          {/* Series element first */}
          <ComponentSvg el={seriesEl} cx={90} cy={midY} horiz />
          <ComponentLabel el={seriesEl} x={90} y={midY - 20} />
          <Wire x1={110} y1={midY} x2={150} y2={midY} />
          {/* Shunt element */}
          <Wire x1={150} y1={midY} x2={150} y2={midY + 16} />
          <ComponentSvg el={shuntEl} cx={150} cy={gndY - 4} horiz={false} />
          <GndSymbol x={150} y={gndY + 16} />
          <ComponentLabel el={shuntEl} x={185} y={gndY} />
          <Wire x1={150} y1={midY} x2={240} y2={midY} />
        </>
      ) : (
        <>
          {/* Shunt element first */}
          <Wire x1={60} y1={midY} x2={60} y2={midY + 16} />
          <ComponentSvg el={shuntEl} cx={60} cy={gndY - 4} horiz={false} />
          <GndSymbol x={60} y={gndY + 16} />
          <ComponentLabel el={shuntEl} x={28} y={gndY} />
          <Wire x1={60} y1={midY} x2={120} y2={midY} />
          {/* Series element */}
          <ComponentSvg el={seriesEl} cx={150} cy={midY} horiz />
          <ComponentLabel el={seriesEl} x={150} y={midY - 20} />
          <Wire x1={170} y1={midY} x2={240} y2={midY} />
        </>
      )}

      {/* Output wire */}
      <PortLabel x={248} y={midY - 8} label="Rl" />
      {/* Ground rail */}
      <Wire x1={10} y1={H - 8} x2={240} y2={H - 8} />
    </svg>
  )
}

// ── π-network schematic ───────────────────────────────────────────────────────
function PiNetworkSvg({ elements }: { elements: Element[] }) {
  if (elements.length !== 3) return null
  const [c1, l1, c2] = elements
  const W = 300; const H = 120
  const midY = 48; const gndY = midY + 30

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Wire x1={10} y1={midY} x2={50} y2={midY} />
      <PortLabel x={10} y={midY - 8} label="Rs" />

      {/* C1 shunt at source */}
      <Wire x1={50} y1={midY} x2={50} y2={midY + 16} />
      <ComponentSvg el={c1} cx={50} cy={gndY - 4} horiz={false} />
      <GndSymbol x={50} y={gndY + 16} />
      <ComponentLabel el={c1} x={20} y={gndY} />

      {/* L1 series */}
      <Wire x1={50} y1={midY} x2={100} y2={midY} />
      <ComponentSvg el={l1} cx={140} cy={midY} horiz />
      <ComponentLabel el={l1} x={140} y={midY - 20} />
      <Wire x1={160} y1={midY} x2={240} y2={midY} />

      {/* C2 shunt at load */}
      <Wire x1={240} y1={midY} x2={240} y2={midY + 16} />
      <ComponentSvg el={c2} cx={240} cy={gndY - 4} horiz={false} />
      <GndSymbol x={240} y={gndY + 16} />
      <ComponentLabel el={c2} x={268} y={gndY} />

      <Wire x1={240} y1={midY} x2={290} y2={midY} />
      <PortLabel x={290} y={midY - 8} label="Rl" />

      <Wire x1={10} y1={H - 8} x2={290} y2={H - 8} />
    </svg>
  )
}

// ── T-network schematic ───────────────────────────────────────────────────────
function TNetworkSvg({ elements }: { elements: Element[] }) {
  if (elements.length !== 3) return null
  const [l1, c1, l2] = elements
  const W = 300; const H = 120
  const midY = 48; const gndY = midY + 30

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Wire x1={10} y1={midY} x2={40} y2={midY} />
      <PortLabel x={10} y={midY - 8} label="Rs" />

      {/* L1 series */}
      <ComponentSvg el={l1} cx={72} cy={midY} horiz />
      <ComponentLabel el={l1} x={72} y={midY - 20} />
      <Wire x1={92} y1={midY} x2={140} y2={midY} />

      {/* C1 shunt */}
      <Wire x1={140} y1={midY} x2={140} y2={midY + 16} />
      <ComponentSvg el={c1} cx={140} cy={gndY - 4} horiz={false} />
      <GndSymbol x={140} y={gndY + 16} />
      <ComponentLabel el={c1} x={165} y={gndY} />

      {/* L2 series */}
      <Wire x1={140} y1={midY} x2={188} y2={midY} />
      <ComponentSvg el={l2} cx={218} cy={midY} horiz />
      <ComponentLabel el={l2} x={218} y={midY - 20} />
      <Wire x1={238} y1={midY} x2={290} y2={midY} />

      <PortLabel x={290} y={midY - 8} label="Rl" />
      <Wire x1={10} y1={H - 8} x2={290} y2={H - 8} />
    </svg>
  )
}

// ── Public component ─────────────────────────────────────────────────────────
export function CircuitSvg({
  networkType,
  elements,
}: {
  networkType: NetworkType
  elements: Element[]
}) {
  if (networkType === 'L') return <LNetworkSvg elements={elements} />
  if (networkType === 'pi') return <PiNetworkSvg elements={elements} />
  return <TNetworkSvg elements={elements} />
}
