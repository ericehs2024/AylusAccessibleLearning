import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'

function toCsv(rows) {
  if (!rows || rows.length === 0) return ''
  const header = ['Name', 'Hours', 'Date', 'Source URL']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [header.map(esc).join(','), ...rows.map(r => [r.name, r.hours, r.date, r.sourceUrl].map(esc).join(','))].join('\n')
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 200)
}

export default function Platform() {
  const [searchParams] = useSearchParams()
  const [url, setUrl] = useState(() => searchParams.get('url') || searchParams.get('branch') || '')
  const [startDate, setStartDate] = useState(() => searchParams.get('start') || searchParams.get('startDate') || '')
  const [endDate, setEndDate] = useState(() => searchParams.get('end') || searchParams.get('endDate') || '')
  const [aliases, setAliases] = useState([{ name: '', aliases: '' }])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [data, setData] = useState(null) // array of records
  const [elapsedMs, setElapsedMs] = useState(null)

  const addAlias = () => setAliases(a => [...a, { name: '', aliases: '' }])
  const removeAlias = (idx) => setAliases(a => a.filter((_, i) => i !== idx))
  const updateAlias = (idx, field, val) => setAliases(a => a.map((row, i) => i === idx ? { ...row, [field]: val } : row))

  const validAliases = aliases.filter(a => a.name.trim() && a.aliases.trim())

  // Deep-link: sync state when URL query changes (e.g. /hour-compiler?url=...&start=...&end=...)
  useEffect(() => {
    const qUrl = searchParams.get('url') || searchParams.get('branch')
    const qStart = searchParams.get('start') || searchParams.get('startDate')
    const qEnd = searchParams.get('end') || searchParams.get('endDate')
    if (qUrl !== null) setUrl(qUrl)
    if (qStart !== null) setStartDate(qStart)
    if (qEnd !== null) setEndDate(qEnd)
  }, [searchParams])

  const handleClear = () => {
    setUrl(''); setStartDate(''); setEndDate(''); setAliases([{ name: '', aliases: '' }])
    setErr(''); setData(null); setElapsedMs(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(''); setData(null); setElapsedMs(null)
    if (!url.trim()) { setErr('Branch URL is required (e.g. https://aylus.org/your-branch/)'); return }
    try { new URL(url.trim()) } catch { setErr('Invalid URL format. Use full https://aylus.org/... URL'); return }
    if (startDate && endDate && startDate > endDate) { setErr('Start date cannot be after end date'); return }
    if (startDate && endDate) {
      const diff = (new Date(endDate) - new Date(startDate)) / (86400000)
      if (diff > 365) { setErr('Date range cannot exceed 365 days'); return }
    }
    setLoading(true)
    const t0 = Date.now()
    try {
      const res = await api.post('/api/scrape', {
        url: url.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        aliases: validAliases,
      }, { timeout: 300000 })
      setElapsedMs(Date.now() - t0)
      const payload = res.data
      const records = payload.data || payload.records || []
      setData(records)
      if (records.length === 0) {
        setErr('No results found for this link and date range. Try a different link or a wider date range.')
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to scrape'
      setErr(msg)
    } finally { setLoading(false) }
  }

  // derived stats
  const totalsByName = {}
  let totalHours = 0
  if (data) {
    for (const r of data) {
      totalsByName[r.name] = (totalsByName[r.name] || 0) + Number(r.hours || 0)
      totalHours += Number(r.hours || 0)
    }
    for (const k of Object.keys(totalsByName)) totalsByName[k] = Math.round(totalsByName[k] * 100) / 100
    totalHours = Math.round(totalHours * 100) / 100
  }
  const sortedVolunteers = Object.entries(totalsByName).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return (
    <div className="container" style={{ padding: '28px 20px' }}>
      {/* Please wait overlay while calculating */}
      {loading && (
        <div role="status" aria-live="polite" aria-label="Calculating total hours" style={{ position:'fixed', inset:0, background:'rgba(252,250,247,0.92)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', border:'1.5px solid #111', borderRadius:6, padding:'28px 32px', textAlign:'center', maxWidth:360, width:'100%' }}>
            <div style={{ width:36, height:36, border:'3px solid #111', borderTopColor:'transparent', borderRadius:'50%', margin:'0 auto 14px', animation:'spin 0.8s linear infinite' }} />
            <div style={{ fontFamily:"'Montserrat', sans-serif", fontWeight:800, fontSize:15, color:'#111' }}>Please wait…</div>
            <div style={{ fontFamily:"'Lato', sans-serif", fontSize:13, color:'#333', marginTop:6, lineHeight:1.5 }}>Calculating total hours. This may take a minute or two.</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 6, fontFamily:"'Montserrat', sans-serif" }}>Hour Compiler</h2>
          <p style={{ color: '#5f6368', fontSize: 14, maxWidth: 720, lineHeight: 1.6, fontFamily:"'Lato', sans-serif" }}>
            Paste your branch link, choose a date range, and get a summary of volunteer hours you can download.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="wire-card" style={{ padding: 20, marginTop: 16 }}>
        <h3 style={{ marginBottom: 14, fontFamily: "'Montserrat', sans-serif", fontSize: 15 }}>Run Hour Compiler</h3>

        <label className="label" htmlFor="platform-url">Branch URL *</label>
        <input id="platform-url" className="input" placeholder="https://aylus.org/your-branch/" value={url} onChange={e => setUrl(e.target.value)} required aria-required="true" style={{ borderWidth: 2, borderColor: '#000' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <div>
            <label className="label" htmlFor="platform-start">Start date (inclusive)</label>
            <input id="platform-start" className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="platform-end">End date (inclusive)</label>
            <input id="platform-end" className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#6b6b6b', marginTop: 6 }}>Leave dates empty to include all time. Max range is one year.</p>

        {/* Alias mapping */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <label className="label" style={{ margin: 0 }}>Name aliases (optional) — merge duplicate names</label>
            <button type="button" className="btn btn-small btn-outline" onClick={addAlias} style={{ padding: '6px 12px' }}>+ Add alias</button>
          </div>
          <p style={{ fontSize: 12, color: '#5f6368', marginBottom: 10 }}>Example: Primary <code>Alice Wang</code> with aliases <code>Alice, Wang Alice</code> will be grouped together.</p>
          {aliases.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label className="label" style={{ fontSize: 10 }}>{idx === 0 ? 'Primary name' : `Primary #${idx + 1}`}</label>
                <input className="input" placeholder="Alice Wang" value={row.name} onChange={e => updateAlias(idx, 'name', e.target.value)} style={{ marginTop: 4 }} />
              </div>
              <div>
                <label className="label" style={{ fontSize: 10 }}>Aliases (comma-separated)</label>
                <input className="input" placeholder="Alice, Wang Alice" value={row.aliases} onChange={e => updateAlias(idx, 'aliases', e.target.value)} style={{ marginTop: 4 }} />
              </div>
              <button type="button" className="btn btn-small btn-outline" onClick={() => removeAlias(idx)} disabled={aliases.length === 1} title="Remove row" style={{ height: 36, padding: '0 10px' }} aria-label={`Remove alias row ${idx + 1}`}>×</button>
            </div>
          ))}
        </div>

        {err && <div style={{ background: '#fce8e6', color: '#b3261e', padding: 10, border: '2px solid #000', marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" className="btn" disabled={loading} style={{ minWidth: 160 }}>
            {loading ? 'Compiling…' : 'Run Hour Compiler'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handleClear} disabled={loading}>Clear</button>
          {loading && <span style={{ fontSize: 12, color: '#5f6368' }}>This may take a minute or two. Please wait.</span>}
        </div>
      </form>

      {/* Results */}
      {data && (
        <>
              <div className="wire-card" style={{ padding: 18, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 15 }}>Results</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-small" onClick={() => downloadCsv(toCsv(data), `aylus-hours-${(startDate || 'all')}-to-${(endDate || 'all')}.csv`)} disabled={data.length === 0}>Download CSV</button>
                <button className="btn btn-small btn-outline" onClick={() => downloadCsv(toCsv(sortedVolunteers.map(([name, hrs]) => ({ name, hours: hrs, date: '', sourceUrl: '' }))), `aylus-totals-${Date.now()}.csv`)} disabled={data.length === 0}>Download Totals CSV</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginTop: 14 }}>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555', fontFamily:"'Mont', 'Montserrat', sans-serif" }}>Records</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000', fontFamily: "'Montserrat', sans-serif" }}>{data.length}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Volunteers</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000' }}>{Object.keys(totalsByName).length}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Total Hours</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000' }}>{totalHours}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Elapsed</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#000' }}>{elapsedMs != null ? `${(elapsedMs / 1000).toFixed(1)}s` : '—'}</div>
                <div style={{ fontSize: 10, color: '#777' }}>{startDate || '—'} → {endDate || '—'}</div>
              </div>
            </div>

            {/* Aggregated totals table */}
            <h4 style={{ marginTop: 20, marginBottom: 8, fontFamily: "'Mont', 'Montserrat', sans-serif", fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>Totals by Volunteer</h4>
            {sortedVolunteers.length === 0 ? (
              <div style={{ padding: 12, border: '1.5px dashed #111', textAlign: 'center', fontSize: 13, color: '#555', borderRadius: 12, background: 'white' }}>No totals to display.</div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1.5px solid #111', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#111', color: 'white' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVolunteers.map(([name, hrs], i) => (
                      <tr key={name} style={{ background: i % 2 === 0 ? 'white' : '#f7f7f7', borderTop: '1px solid #e5e5e5' }}>
                        <td style={{ padding: '7px 12px', color: '#555' }}>{i + 1}</td>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{name}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{hrs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detailed records */}
            <h4 style={{ marginTop: 20, marginBottom: 8, fontFamily: "'Mont', 'Montserrat', sans-serif", fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>Detailed Records</h4>
            {data.length === 0 ? (
              <div style={{ padding: 12, border: '1.5px dashed #111', textAlign: 'center', fontSize: 13, color: '#555', borderRadius: 12, background: 'white' }}>No detailed records.</div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1.5px solid #111', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#111', color: 'white' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>Hours</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={`${r.name}-${r.date}-${i}`} style={{ background: i % 2 === 0 ? 'white' : '#f7f7f7', borderTop: '1px solid #e5e5e5' }}>
                        <td style={{ padding: '6px 10px', color: '#555' }}>{i + 1}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{r.hours}</td>
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '6px 10px', maxWidth: 260, wordBreak: 'break-all' }}>
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="wire-link" style={{ fontSize: 11 }}>{r.sourceUrl}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
