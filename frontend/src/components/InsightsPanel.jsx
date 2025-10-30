import React from 'react'

export default function InsightsPanel({ insights, summary, strengths, weaknesses }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Business Insights</h2>
      {!insights && !summary && (!strengths && !weaknesses) && (
        <div className="text-slate-500 text-sm">No insights yet. Upload a dataset first.</div>
      )}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-600">Executive Report</div>
          <div className="mt-1">{summary}</div>
        </div>
      )}
      {insights && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-600 mb-2">Key EDA Highlights</div>
          <ul className="list-disc list-inside space-y-1">
            {insights.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {strengths && (
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="text-sm text-green-700 font-semibold mb-1">Strengths</div>
          <div>{strengths}</div>
        </div>
      )}
      {weaknesses && (
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <div className="text-sm text-rose-700 font-semibold mb-1">Weaknesses</div>
          <div>{weaknesses}</div>
        </div>
      )}
    </div>
  )
}


