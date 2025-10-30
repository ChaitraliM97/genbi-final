import React, { useRef, useState } from 'react'
import axios from 'axios'
import { clientAnalyze } from '../utils/clientAnalyze'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function UploadCard({ loading, setLoading, onResult, onError }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')

  const onSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFileName(f.name)
    }
  }

  const onUpload = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setLoading(true)
    onError('')
    try {
      const res = await axios.post(`${API_BASE}/analyze`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      })
      onResult(res.data)
    } catch (err) {
      try {
        const local = await clientAnalyze(file)
        onResult(local)
      } catch (localErr) {
        onError(err?.response?.data?.detail || err.message || 'Upload failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="font-medium">File upload</div>
          <div className="text-sm text-slate-600">CSV or Excel (XLS/XLSX)</div>
        </div>
        <div className="flex items-center gap-3">
          <input ref={inputRef} onChange={onSelect} type="file" accept=".csv,.xlsx,.xls" className="hidden" />
          <button onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800">
            {fileName ? 'Choose different file' : 'Choose file'}
          </button>
          <button onClick={onUpload} disabled={loading || !fileName} className="px-4 py-2 rounded-md bg-primary-600 text-white disabled:opacity-50">
            {loading ? 'Analyzing…' : 'Upload & Analyze'}
          </button>
        </div>
      </div>
      {fileName && <div className="text-xs text-slate-500 mt-2">Selected: {fileName}</div>}
      {loading && (
        <div className="mt-4 text-sm text-slate-600 animate-pulse">Analyzing your data…</div>
      )}
    </div>
  )
}


