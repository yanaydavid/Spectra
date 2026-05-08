import type { CascadeResult, RFComponent, SystemParams } from '../types'

function db(v: number | null | undefined, decimals = 1) {
  return v == null ? '—' : v.toFixed(decimals)
}

function dbToLinear(db: number) {
  return Math.pow(10, db / 10)
}

function fspl(freq_ghz: number, distance_km: number): number {
  return 92.45 + 20 * Math.log10(freq_ghz) + 20 * Math.log10(distance_km)
}

// ── NF Budget SVG ────────────────────────────────────────────────────────────
function buildNfBudgetSvg(
  stages: CascadeResult['per_stage'],
  totalNfDb: number,
): string {
  const totalF = dbToLinear(totalNfDb)
  const budget = stages.map((s, i) => {
    const fCum = dbToLinear(s.cumulative_nf_db)
    const fPrev = i === 0 ? 0 : dbToLinear(stages[i - 1].cumulative_nf_db)
    const contribution = fCum - fPrev
    const pct = (contribution / totalF) * 100
    return { name: s.component_name, pct: Math.max(0, pct) }
  })

  const maxPct = Math.max(...budget.map((b) => b.pct))
  const rowH = 28
  const labelW = 120
  const barMaxW = 260
  const svgH = budget.length * rowH + 16
  const svgW = labelW + barMaxW + 60

  const rows = budget
    .map((b, i) => {
      const barW = maxPct > 0 ? (b.pct / maxPct) * barMaxW : 0
      const color =
        b.pct / maxPct > 0.6 ? '#ef4444' : b.pct / maxPct > 0.25 ? '#f59e0b' : '#6b7280'
      const y = i * rowH + 8
      const label = b.name.length > 14 ? b.name.slice(0, 14) + '…' : b.name
      return `
        <text x="${labelW - 6}" y="${y + 13}" text-anchor="end" font-size="11" fill="#9ca3af">${label}</text>
        <rect x="${labelW}" y="${y}" width="${barW.toFixed(1)}" height="18" rx="2" fill="${color}"/>
        <text x="${labelW + barW + 5}" y="${y + 13}" font-size="11" fill="#6b7280">${b.pct.toFixed(1)}%</text>
      `
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"
    style="background:#1f2937;border-radius:6px;padding:8px">${rows}</svg>`
}

// ── Gain/NF Line Chart SVG ───────────────────────────────────────────────────
function buildChainChartSvg(stages: CascadeResult['per_stage']): string {
  if (stages.length < 2) return ''

  const W = 440
  const H = 120
  const padL = 36
  const padR = 16
  const padT = 12
  const padB = 24

  const gains = stages.map((s) => s.cumulative_gain_db)
  const nfs = stages.map((s) => s.cumulative_nf_db)
  const allVals = [...gains, ...nfs]
  const minV = Math.floor(Math.min(...allVals)) - 1
  const maxV = Math.ceil(Math.max(...allVals)) + 1

  const xOf = (i: number) =>
    padL + (i / (stages.length - 1)) * (W - padL - padR)
  const yOf = (v: number) =>
    padT + ((maxV - v) / (maxV - minV)) * (H - padT - padB)

  function polyline(vals: number[], color: string) {
    const pts = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>`
  }

  const xLabels = stages
    .map((s, i) => {
      const name = s.component_name.length > 6 ? s.component_name.slice(0, 6) + '…' : s.component_name
      return `<text x="${xOf(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#6b7280">${name}</text>`
    })
    .join('')

  // y-axis ticks
  const ticks = [minV, Math.round((minV + maxV) / 2), maxV]
    .map(
      (v) =>
        `<text x="${padL - 4}" y="${(yOf(v) + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#6b7280">${v}</text>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
    style="background:#1f2937;border-radius:6px">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#374151" stroke-width="1"/>
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#374151" stroke-width="1"/>
    ${ticks}
    ${xLabels}
    ${polyline(gains, '#34d399')}
    ${polyline(nfs, '#fbbf24')}
    <text x="${padL + 8}" y="${padT + 10}" font-size="9" fill="#34d399">■ Gain (dB)</text>
    <text x="${padL + 80}" y="${padT + 10}" font-size="9" fill="#fbbf24">■ NF (dB)</text>
  </svg>`
}

// ── Main HTML builder ────────────────────────────────────────────────────────
export function generateReport(
  chain: string[],
  components: Record<string, RFComponent>,
  systemParams: SystemParams,
  cascadeResult: CascadeResult,
): void {
  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const stages = chain.map((id) => components[id]).filter(Boolean)
  const r = cascadeResult
  const nfBudgetSvg = buildNfBudgetSvg(r.per_stage, r.cascaded_nf_db)
  const chainChartSvg = buildChainChartSvg(r.per_stage)
  const hasIip3 = r.per_stage.some((s) => s.cumulative_iip3_dbm != null)

  // Dynamic range calculations
  const noiseFloor  = r.sensitivity_dbm
  const sfdr        = (2 / 3) * (r.cascaded_iip3_dbm - noiseFloor)
  const idr         = r.cascaded_iip3_dbm - noiseFloor
  const p1db_in     = r.cascaded_iip3_dbm - 9.6
  const bdr         = p1db_in - noiseFloor

  const stageRows = r.per_stage
    .map((s) => {
      const comp = stages.find((c) => c.id === s.component_id) ?? stages[s.stage_index]
      return `
        <tr>
          <td>${s.stage_index + 1}</td>
          <td>${s.component_name}</td>
          <td>${db(comp?.gain_db)} dB</td>
          <td>${db(comp?.nf_db)} dB</td>
          <td>${comp?.iip3_dbm != null ? db(comp.iip3_dbm) + ' dBm' : '—'}</td>
          <td>${db(s.cumulative_gain_db)} dB</td>
          <td>${db(s.cumulative_nf_db, 2)} dB</td>
          ${hasIip3 ? `<td>${s.cumulative_iip3_dbm != null ? db(s.cumulative_iip3_dbm) + ' dBm' : '—'}</td>` : ''}
        </tr>`
    })
    .join('')

  const bomRows = stages
    .map(
      (c, i) => `
        <tr>
          <td>U${i + 1}</td>
          <td>${c.name}</td>
          <td>${c.type}</td>
          <td>${db(c.gain_db)} dB</td>
          <td>${db(c.nf_db)} dB</td>
          <td>${c.iip3_dbm != null ? db(c.iip3_dbm) + ' dBm' : '—'}</td>
          <td>${c.p1db_dbm != null ? db(c.p1db_dbm) + ' dBm' : '—'}</td>
          <td>${c.source === 'datasheet' ? 'Datasheet' : 'Manual'}</td>
        </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>RF Chain Design Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; font-size: 12px; }

    /* ── Cover ── */
    .cover {
      background: #0f172a;
      color: #f1f5f9;
      padding: 48px 56px 40px;
      min-height: 180px;
    }
    .cover h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: #f8fafc; }
    .cover .subtitle { font-size: 14px; color: #94a3b8; margin-top: 6px; }
    .cover .meta { display: flex; gap: 32px; margin-top: 24px; }
    .cover .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .cover .meta-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
    .cover .meta-item .value { font-size: 13px; color: #e2e8f0; font-weight: 500; }
    .cover .badge { display: inline-block; background: #7c3aed; color: #fff; font-size: 10px;
      padding: 2px 8px; border-radius: 12px; margin-top: 20px; letter-spacing: 0.5px; }

    /* ── Sections ── */
    .section { padding: 28px 56px; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    h2 { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 16px;
      padding-bottom: 6px; border-bottom: 2px solid #7c3aed; display: inline-block; }

    /* ── Metric cards ── */
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0; }
    .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
    .metric-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; }
    .metric-card .value { font-size: 22px; font-weight: 700; font-family: 'Courier New', monospace;
      margin-top: 4px; line-height: 1; }
    .metric-card .unit { font-size: 11px; font-weight: 400; color: #94a3b8; margin-left: 2px; }
    .metric-card.nf .value { color: #d97706; }
    .metric-card.gain .value { color: #059669; }
    .metric-card.iip3 .value { color: #2563eb; }
    .metric-card.sens .value { color: #7c3aed; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #1e293b; color: #f1f5f9; }
    thead th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.5px; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 7px 10px; color: #334155; }
    tbody td:first-child { color: #64748b; font-weight: 600; }
    .mono { font-family: 'Courier New', monospace; }

    /* ── Charts ── */
    .charts-row { display: flex; gap: 24px; align-items: flex-start; }
    .chart-box { flex: 1; }
    .chart-box h3 { font-size: 11px; font-weight: 600; color: #475569;
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

    /* ── System params ── */
    .params-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .param-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .param-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .param-item .value { font-size: 14px; font-weight: 600; color: #1e293b; font-family: 'Courier New', monospace; margin-top: 2px; }

    /* ── Footer ── */
    .footer { padding: 16px 56px; background: #f8fafc; color: #94a3b8; font-size: 10px;
      display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <div class="badge">◈ SPECTRA RF</div>
  <h1 style="margin-top:12px">RF Chain Design Report</h1>
  <p class="subtitle">${stages.length}-stage receive chain · ${systemParams.frequency_ghz ?? 2.4} GHz</p>
  <div class="meta">
    <div class="meta-item">
      <span class="label">Generated</span>
      <span class="value">${now}</span>
    </div>
    <div class="meta-item">
      <span class="label">Stages</span>
      <span class="value">${stages.length}</span>
    </div>
    <div class="meta-item">
      <span class="label">Bandwidth</span>
      <span class="value">${(systemParams.bandwidth_hz / 1e6).toFixed(1)} MHz</span>
    </div>
    <div class="meta-item">
      <span class="label">Temperature</span>
      <span class="value">${systemParams.temperature_k} K</span>
    </div>
  </div>
</div>

<!-- Key Metrics -->
<div class="section">
  <h2>Key Performance Metrics</h2>
  <div class="metrics">
    <div class="metric-card nf">
      <div class="label">Cascaded NF</div>
      <div class="value">${db(r.cascaded_nf_db)}<span class="unit">dB</span></div>
    </div>
    <div class="metric-card gain">
      <div class="label">Total Gain</div>
      <div class="value">${db(r.total_gain_db)}<span class="unit">dB</span></div>
    </div>
    <div class="metric-card iip3">
      <div class="label">Cascaded IIP3</div>
      <div class="value">${db(r.cascaded_iip3_dbm)}<span class="unit">dBm</span></div>
    </div>
    <div class="metric-card sens">
      <div class="label">Sensitivity (MDS)</div>
      <div class="value">${db(r.sensitivity_dbm)}<span class="unit">dBm</span></div>
    </div>
  </div>
</div>

<!-- Dynamic Range -->
<div class="section">
  <h2>Dynamic Range</h2>
  <div class="metrics">
    <div class="metric-card" style="border-color:#fecdd3">
      <div class="label">SFDR</div>
      <div class="value" style="color:#f43f5e">${sfdr.toFixed(1)}<span class="unit">dB</span></div>
    </div>
    <div class="metric-card" style="border-color:#fed7aa">
      <div class="label">Instantaneous DR</div>
      <div class="value" style="color:#f97316">${idr.toFixed(1)}<span class="unit">dB</span></div>
    </div>
    <div class="metric-card" style="border-color:#fef08a">
      <div class="label">Blocking DR</div>
      <div class="value" style="color:#eab308">${bdr.toFixed(1)}<span class="unit">dB</span></div>
    </div>
    <div class="metric-card">
      <div class="label">P1dB (input)</div>
      <div class="value" style="color:#6b7280">${p1db_in.toFixed(1)}<span class="unit">dBm</span></div>
    </div>
  </div>
  <p style="font-size:10px;color:#94a3b8;margin-top:12px">
    SFDR = (2/3)·(IIP3 − Noise Floor) &nbsp;|&nbsp;
    IDR = IIP3 − Noise Floor &nbsp;|&nbsp;
    BDR = P1dB(in) − Noise Floor &nbsp;|&nbsp;
    P1dB(in) ≈ IIP3 − 9.6 dB
  </p>
</div>

<!-- Charts -->
<div class="section">
  <h2>Chain Analysis</h2>
  <div class="charts-row">
    ${chainChartSvg ? `<div class="chart-box">
      <h3>Cumulative Gain &amp; NF Along Chain</h3>
      ${chainChartSvg}
    </div>` : ''}
    <div class="chart-box">
      <h3>Noise Figure Budget — Per-Stage Contribution</h3>
      ${nfBudgetSvg}
    </div>
  </div>
</div>

<!-- Per-Stage Table -->
<div class="section">
  <h2>Per-Stage Cascade Analysis</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Component</th>
        <th>Stage Gain</th>
        <th>Stage NF</th>
        <th>Stage IIP3</th>
        <th>Cum. Gain</th>
        <th>Cum. NF</th>
        ${hasIip3 ? '<th>Cum. IIP3</th>' : ''}
      </tr>
    </thead>
    <tbody>${stageRows}</tbody>
  </table>
</div>

<!-- BOM -->
<div class="section">
  <h2>Bill of Materials (BOM)</h2>
  <table>
    <thead>
      <tr>
        <th>Ref</th>
        <th>Component</th>
        <th>Type</th>
        <th>Gain</th>
        <th>NF</th>
        <th>IIP3</th>
        <th>P1dB</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>${bomRows}</tbody>
  </table>
</div>

<!-- System Parameters -->
<div class="section">
  <h2>System Parameters</h2>
  <div class="params-grid">
    <div class="param-item">
      <div class="label">Center Frequency</div>
      <div class="value">${systemParams.frequency_ghz ?? 2.4} GHz</div>
    </div>
    <div class="param-item">
      <div class="label">Bandwidth</div>
      <div class="value">${(systemParams.bandwidth_hz / 1e6).toFixed(1)} MHz</div>
    </div>
    <div class="param-item">
      <div class="label">System Temperature</div>
      <div class="value">${systemParams.temperature_k} K</div>
    </div>
    <div class="param-item">
      <div class="label">Thermal Noise Floor</div>
      <div class="value">${(10 * Math.log10(1.38e-23 * systemParams.temperature_k * systemParams.bandwidth_hz) + 30).toFixed(1)} dBm</div>
    </div>
    <div class="param-item">
      <div class="label">Chain Stages</div>
      <div class="value">${stages.length}</div>
    </div>
    <div class="param-item">
      <div class="label">Report Generated</div>
      <div class="value" style="font-size:11px">${now}</div>
    </div>
  </div>
</div>

<!-- Footer -->
<div class="footer">
  <span>◈ Spectra RF Chain Calculator</span>
  <span>Generated ${now}</span>
</div>

<script>
  window.onload = () => window.print()
</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
