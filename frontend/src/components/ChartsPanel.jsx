import React from 'react'
import Plot from 'react-plotly.js'

function ImgChart({ title, b64 }) {
  if (!b64) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="font-medium mb-2">{title}</div>
      <img src={`data:image/png;base64,${b64}`} alt={title} className="w-full h-auto rounded" />
    </div>
  )
}

function PlotCard({ title, cfg }){
  if (!cfg) return null
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="font-medium mb-2">{title}</div>
      <Plot data={cfg.data} layout={{...cfg.layout, autosize: true}} style={{width:'100%', height:'100%'}} useResizeHandler />
    </div>
  )
}

export default function ChartsPanel({ loading, charts, stats, plotlyCharts }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">EDA & Charts</h2>
        {stats?.shape && (
          <div className="text-sm text-slate-600">Rows: {stats.shape[0]} • Columns: {stats.shape[1]}</div>
        )}
      </div>
      {!charts && !plotlyCharts && !loading && (
        <div className="text-slate-500 text-sm">Upload a dataset to view charts.</div>
      )}
      {charts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImgChart title="Histogram" b64={charts.histogram} />
          <ImgChart title="Correlation Heatmap" b64={charts.correlation_heatmap} />
          <ImgChart title="Trend Line" b64={charts.trend_line} />
          <ImgChart title="Top Categories" b64={charts.bar_categorical} />
          <ImgChart title="Proportions" b64={charts.pie_proportions} />
        </div>
      )}
      {plotlyCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlotCard title="Histogram" cfg={plotlyCharts.histogram} />
          <PlotCard title="Correlation Heatmap" cfg={plotlyCharts.correlation_heatmap} />
          <PlotCard title="Trend Line" cfg={plotlyCharts.trend_line} />
          <PlotCard title="Top Categories" cfg={plotlyCharts.bar_categorical} />
          <PlotCard title="Proportions" cfg={plotlyCharts.pie_proportions} />
        </div>
      )}
    </div>
  )
}


