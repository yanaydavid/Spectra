import type { StabilityCircle, ComplexNum } from '../../utils/stability'

const CX = 110   // SVG center x
const CY = 110   // SVG center y
const R  = 95    // unit circle radius in SVG px

// Convert Γ (complex) → SVG coordinates
function toSvg(c: ComplexNum): [number, number] {
  return [CX + c.re * R, CY - c.im * R]
}

// ── Smith Chart background grid ───────────────────────────────────────────────

const GRID_COLOR     = '#1f2937'
const GRID_COLOR_MID = '#374151'
const TEXT_COLOR     = '#4b5563'

function ResistanceCircles() {
  const resistances = [0, 0.2, 0.5, 1, 2, 5]
  return (
    <>
      {resistances.map((r) => {
        const cx_svg = CX + (r / (r + 1)) * R
        const r_svg  = R / (r + 1)
        const color  = r === 1 ? GRID_COLOR_MID : GRID_COLOR
        return (
          <circle key={r} cx={cx_svg} cy={CY} r={r_svg}
            fill="none" stroke={color} strokeWidth={r === 0 ? 1.5 : 0.75} />
        )
      })}
      {/* R labels */}
      {[0.5, 1, 2].map((r) => (
        <text key={r}
          x={CX + (r / (r + 1)) * R}
          y={CY + 6}
          fontSize={7} fill={TEXT_COLOR} textAnchor="middle">
          {r}
        </text>
      ))}
    </>
  )
}

function ReactanceArcs() {
  const reactances = [0.2, 0.5, 1, 2, 5]
  const clipId = 'smith-clip'

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>
      {reactances.map((x) => {
        // Reactance arc circle: center=(R_px+CX, CY - R_px/x), radius=R_px/x
        const r_arc = R / x
        const cx_arc = CX + R
        return (
          <g key={x} clipPath={`url(#${clipId})`}>
            {/* Positive reactance (upper half) */}
            <circle cx={cx_arc} cy={CY - r_arc} r={r_arc}
              fill="none" stroke={GRID_COLOR} strokeWidth={0.75} />
            {/* Negative reactance (lower half) */}
            <circle cx={cx_arc} cy={CY + r_arc} r={r_arc}
              fill="none" stroke={GRID_COLOR} strokeWidth={0.75} />
          </g>
        )
      })}
      {/* Horizontal axis */}
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY}
        stroke={GRID_COLOR_MID} strokeWidth={0.75} />
    </>
  )
}

// ── Stability circle ──────────────────────────────────────────────────────────

interface CircleProps {
  circle: StabilityCircle
  color: string
  label: string
}

function StabilityCircleEl({ circle, color, label }: CircleProps) {
  const [cx, cy] = toSvg(circle.center)
  const r_svg = circle.radius * R

  return (
    <g>
      <circle cx={cx} cy={cy} r={r_svg}
        fill={color + '22'} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={cx} y={cy} fontSize={8} fill={color} textAnchor="middle" dominantBaseline="middle"
        fontWeight="bold">
        {label}
      </text>
    </g>
  )
}

// ── S-param dot ───────────────────────────────────────────────────────────────

function SParamDot({ gamma, label, color }: { gamma: ComplexNum; label: string; color: string }) {
  const [x, y] = toSvg(gamma)
  return (
    <g>
      <circle cx={x} cy={y} r={3.5} fill={color} />
      <text x={x + 5} y={y - 4} fontSize={8} fill={color}>{label}</text>
    </g>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  inputCircle: StabilityCircle
  outputCircle: StabilityCircle
  s11: ComplexNum
  s22: ComplexNum
}

export function SmithChart({ inputCircle, outputCircle, s11, s22 }: Props) {
  const size = CX * 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background: '#030712', borderRadius: 8 }}>

      {/* Background */}
      <circle cx={CX} cy={CY} r={R} fill="#0a0f1e" />

      {/* Grid */}
      <ResistanceCircles />
      <ReactanceArcs />

      {/* Outer ring label */}
      <text x={CX + R + 4} y={CY + 4} fontSize={8} fill={TEXT_COLOR}>Γ=1</text>
      <text x={CX - R - 18} y={CY + 4} fontSize={8} fill={TEXT_COLOR}>sc</text>
      <text x={CX - 4} y={CY - R - 4} fontSize={8} fill={TEXT_COLOR}>+jX</text>

      {/* Stability circles */}
      <StabilityCircleEl circle={inputCircle}  color="#f59e0b" label="IS" />
      <StabilityCircleEl circle={outputCircle} color="#60a5fa" label="OS" />

      {/* S11, S22 dots */}
      <SParamDot gamma={s11} label="S₁₁" color="#fbbf24" />
      <SParamDot gamma={s22} label="S₂₂" color="#93c5fd" />

      {/* Legend */}
      <rect x={4} y={size - 32} width={100} height={28} fill="#0f172a" rx={3} opacity={0.9} />
      <circle cx={12} cy={size - 22} r={4} fill="#f59e0b22" stroke="#f59e0b" strokeWidth={1} />
      <text x={20} y={size - 18} fontSize={8} fill="#f59e0b">Input stability</text>
      <circle cx={12} cy={size - 11} r={4} fill="#60a5fa22" stroke="#60a5fa" strokeWidth={1} />
      <text x={20} y={size - 7} fontSize={8} fill="#60a5fa">Output stability</text>
    </svg>
  )
}
