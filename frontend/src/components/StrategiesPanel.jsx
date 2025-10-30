import React, { useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function StrategiesPanel({ strategies, summary }) {
  const pdfRef = useRef(null)

  const downloadPDF = async () => {
    if (!pdfRef.current) return
    const element = pdfRef.current
    const canvas = await html2canvas(element, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    const imgHeight = (imgProps.height * pageWidth) / imgProps.width
    let y = 10
    if (imgHeight < pageHeight) {
      pdf.addImage(imgData, 'PNG', 10, y, pageWidth - 20, imgHeight)
    } else {
      // Split if too long
      let position = 0
      while (position < imgHeight) {
        pdf.addImage(imgData, 'PNG', 10, 10 - position, pageWidth - 20, imgHeight)
        position += pageHeight - 20
        if (position < imgHeight) pdf.addPage()
      }
    }
    pdf.save('business-report.pdf')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Strategies</h2>
        <button onClick={downloadPDF} disabled={!strategies && !summary} className="px-3 py-2 rounded-md bg-primary-600 text-white disabled:opacity-50">Download PDF</button>
      </div>
      <div ref={pdfRef} className="space-y-4">
        {summary && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600">Executive Summary</div>
            <div className="mt-1">{summary}</div>
          </div>
        )}
        {strategies && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-2">Top 3 Actions</div>
            <ol className="list-decimal list-inside space-y-1">
              {strategies.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}


