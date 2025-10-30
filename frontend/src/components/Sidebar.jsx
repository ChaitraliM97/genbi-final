import React from 'react'

export default function Sidebar({ sections }) {
  return (
    <aside className="w-60 hidden md:block border-r border-slate-200 bg-white/60 backdrop-blur">
      <div className="p-6">
        <div className="text-lg font-semibold mb-4">Gen BI</div>
        <nav className="space-y-2">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="block px-3 py-2 rounded-md hover:bg-slate-100 text-slate-700">
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}


