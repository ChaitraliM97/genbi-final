import Papa from 'papaparse'
import * as XLSX from 'xlsx'

function detectDatetimeColumns(columns) {
  return columns.filter(c => /date|time/i.test(String(c)))
}

function toNumber(value) {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? n : null
}

function cleanData(rows) {
  if (!rows.length) return rows
  const columns = Object.keys(rows[0] || {})
  // Impute: numeric -> median, categorical -> mode
  const numericCols = []
  const categoricalCols = []
  for (const c of columns) {
    const nums = rows.map(r => toNumber(r[c])).filter(v => v !== null)
    if (nums.length >= rows.length * 0.5) numericCols.push(c)
    else categoricalCols.push(c)
  }
  const medians = {}
  for (const c of numericCols) {
    const nums = rows.map(r => toNumber(r[c])).filter(v => v !== null).sort((a,b)=>a-b)
    const mid = Math.floor(nums.length/2)
    medians[c] = nums.length ? (nums.length % 2 ? nums[mid] : (nums[mid-1]+nums[mid])/2) : 0
  }
  const modes = {}
  for (const c of categoricalCols) {
    const freq = new Map()
    for (const r of rows) {
      const v = r[c] ?? 'Unknown'
      freq.set(v, (freq.get(v)||0)+1)
    }
    let best = 'Unknown', cnt = -1
    for (const [k,v] of freq) if (v>cnt) { best=k; cnt=v }
    modes[c] = best
  }
  // Fill and clip numeric by IQR
  const filled = rows.map(r => ({...r}))
  for (const c of numericCols) {
    const nums = filled.map(r => toNumber(r[c]) ?? medians[c])
    const q1 = quantile(nums, 0.25)
    const q3 = quantile(nums, 0.75)
    const iqr = q3 - q1
    const lo = q1 - 1.5*iqr, hi = q3 + 1.5*iqr
    for (const r of filled) {
      let v = toNumber(r[c])
      if (v === null) v = medians[c]
      if (v < lo) v = lo
      if (v > hi) v = hi
      r[c] = v
    }
  }
  for (const c of categoricalCols) {
    for (const r of filled) {
      if (r[c] == null || r[c] === '') r[c] = modes[c]
    }
  }
  return filled
}

function quantile(arr, q){
  if (!arr.length) return 0
  const a = [...arr].sort((x,y)=>x-y)
  const pos = (a.length-1)*q
  const base = Math.floor(pos)
  const rest = pos - base
  return a[base + 1] !== undefined ? a[base] + rest*(a[base+1]-a[base]) : a[base]
}

function correlationMatrix(rows, numericCols){
  const mat = []
  const colMeans = {}
  const data = numericCols.map(c => rows.map(r => Number(r[c]) || 0))
  for (let i=0;i<numericCols.length;i++) {
    const arr = data[i]
    colMeans[i] = arr.reduce((s,v)=>s+v,0)/Math.max(1,arr.length)
  }
  const stds = {}
  for (let i=0;i<numericCols.length;i++) {
    const arr = data[i]
    const mean = colMeans[i]
    stds[i] = Math.sqrt(arr.reduce((s,v)=>s+(v-mean)**2,0)/Math.max(1,arr.length)) || 0.000001
  }
  for (let i=0;i<numericCols.length;i++){
    const row = []
    for (let j=0;j<numericCols.length;j++){
      const a = data[i], b = data[j]
      const meanA = colMeans[i], meanB = colMeans[j]
      const num = a.reduce((s,v,idx)=> s + (v-meanA)*(b[idx]-meanB), 0)
      const den = (a.length-1) * stds[i] * stds[j]
      row.push(den ? (num/den) : 0)
    }
    mat.push(row)
  }
  return mat
}

function deriveInsights(rows){
  const cols = Object.keys(rows[0]||{})
  const numeric = cols.filter(c => rows.some(r => Number.isFinite(Number(r[c]))))
  const insights = []
  if (numeric.length){
    const c = numeric[0]
    const vals = rows.map(r => Number(r[c]) || 0)
    const mean = vals.reduce((s,v)=>s+v,0)/Math.max(vals.length,1)
    const sorted = [...vals].sort((a,b)=>a-b)
    const mid = Math.floor(sorted.length/2)
    const median = sorted.length ? (sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):0
    const mu = mean
    const sd = Math.sqrt(vals.reduce((s,v)=>s+(v-mu)**2,0)/Math.max(vals.length,1))
    if (sd>0 && mu!==0){
      const cv = sd/Math.abs(mu)
      if (cv>0.8) insights.push(`High variability detected in ${c} (CV ~ ${cv.toFixed(2)}).`)
    }
    insights.unshift(`Key metric ${c}: mean ${mean.toFixed(2)}, median ${median.toFixed(2)}.`)
  }
  const datetime = detectDatetimeColumns(cols)
  if (datetime.length) {
    insights.push(`Time dimension detected in ${datetime[0]}. Trend analysis included.`)
  }
  const categorical = cols.filter(c => !numeric.includes(c))
  if (categorical.length){
    const c = categorical[0]
    const freq = new Map()
    for (const r of rows){
      const v = r[c] ?? 'Unknown'
      freq.set(v, (freq.get(v)||0)+1)
    }
    const arr = [...freq.entries()].sort((a,b)=>b[1]-a[1])
    if (arr.length){
      const [top, cnt] = arr[0]
      insights.push(`Category ${c} dominated by ${top} (~${(cnt/rows.length*100).toFixed(1)}%).`)
    }
  }
  return insights
}

function buildPlotlyCharts(rows){
  const cols = Object.keys(rows[0]||{})
  const datetime = detectDatetimeColumns(cols)
  const numeric = cols.filter(c => rows.some(r => Number.isFinite(Number(r[c]))))
  const categorical = cols.filter(c => !numeric.includes(c))
  const charts = {}
  if (numeric.length){
    const c = numeric[0]
    charts.histogram = {
      data: [{ type: 'histogram', x: rows.map(r=> Number(r[c])||0), marker: { color: '#5b7cfa' } }],
      layout: { title: `Distribution of ${c}`, margin: { t: 40, r: 10, l: 40, b: 40 } }
    }
  }
  if (numeric.length>=2){
    const mat = correlationMatrix(rows, numeric)
    charts.correlation_heatmap = {
      data: [{ type: 'heatmap', z: mat, x: numeric, y: numeric, colorscale: 'RdBu', reversescale: true }],
      layout: { title: 'Correlation Heatmap', margin: { t: 40, r: 10, l: 80, b: 40 } }
    }
  }
  if (datetime.length && numeric.length){
    const dt = datetime[0]
    const val = numeric[0]
    const tmp = rows.map(r => ({ x: new Date(r[dt]), y: Number(r[val])||0 }))
      .filter(d => !isNaN(d.x.getTime()))
      .sort((a,b)=>a.x-b.x)
    charts.trend_line = {
      data: [{ type: 'scatter', mode: 'lines', x: tmp.map(d=>d.x), y: tmp.map(d=>d.y), line: { color: '#4b6cf0' } }],
      layout: { title: `Trend of ${val} over ${dt}`, margin: { t: 40, r: 10, l: 40, b: 40 } }
    }
  }
  if (categorical.length){
    const c = categorical[0]
    const freq = new Map()
    for (const r of rows){
      const v = r[c] ?? 'Unknown'
      freq.set(v, (freq.get(v)||0)+1)
    }
    const sorted = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)
    charts.bar_categorical = {
      data: [{ type: 'bar', x: sorted.map(x=>x[1]), y: sorted.map(x=>x[0]), orientation: 'h', marker:{color:'#5b7cfa'} }],
      layout: { title: `Top ${c} categories`, margin: { t: 40, r: 10, l: 120, b: 40 } }
    }
    const top6 = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6)
    charts.pie_proportions = {
      data: [{ type: 'pie', values: top6.map(x=>x[1]), labels: top6.map(x=>x[0]) }],
      layout: { title: `${c} proportions`, margin: { t: 40, r: 10, l: 10, b: 10 } }
    }
  }
  return charts
}

function summaryAndStrategies(insights){
  const concise = insights.slice(0,3).join('; ')
  const summary = concise ? `Executive summary: ${concise}.` : 'The dataset was analyzed. No strong trends detected.'
  const strategies = [
    'Improve retention with incentives and onboarding for risk segments.',
    'Optimize pricing versus competitors and regional elasticity.',
    'Reduce refunds via root-cause analysis and proactive support.',
  ]
  return { summary, strategies }
}

async function readFileToRows(file){
  const name = (file?.name||'').toLowerCase()
  const buf = await file.arrayBuffer()
  if (name.endsWith('.csv')){
    const text = new TextDecoder().decode(new Uint8Array(buf))
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    return parsed.data
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')){
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(ws, { defval: null })
    return json
  }
  // try CSV fallback
  const text = new TextDecoder().decode(new Uint8Array(buf))
  const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
  return parsed.data
}

export async function clientAnalyze(file){
  const raw = await readFileToRows(file)
  if (!raw?.length) throw new Error('File parsed but contains no rows.')
  const clean = cleanData(raw)
  const cols = Object.keys(clean[0]||{})
  const numeric = cols.filter(c => clean.some(r => Number.isFinite(Number(r[c]))))
  const categorical = cols.filter(c => !numeric.includes(c))
  const plotlyCharts = buildPlotlyCharts(clean)
  const insights = deriveInsights(clean)
  const { summary, strategies } = summaryAndStrategies(insights)
  const stats = {
    shape: [clean.length, cols.length],
    columns: cols,
    numeric_columns: numeric,
    categorical_columns: categorical,
  }
  return {
    report_summary: summary,
    strategies,
    insights,
    stats,
    charts: null,
    plotlyCharts,
  }
}


