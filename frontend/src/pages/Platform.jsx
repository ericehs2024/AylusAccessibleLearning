import React, { useState, useEffect, useMemo } from 'react'
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

const FETCH_FAILED_MSG = 'Failed in fetching original activity posts. Please retry.'
const AI_BUSY_MSG = 'AI is busy, please retry after 5 minutes.'

// Never surface raw 500/504/axios internals to users — map to two friendly messages.
// Raw detail stays in the console (see console.error in handleSubmit).
function friendlyScrapeError(e) {
  const data = e.response?.data || {}
  const code = data.code
  if (code === 'AI_BUSY') {
    // Server-provided wait (its retry interval + 5 min buffer) wins when present
    if (Number.isFinite(data.retryInSec)) return `AI is busy, please retry after ${Math.max(1, Math.ceil(data.retryInSec / 60))} minutes.`
    if (typeof data.error === 'string' && /^AI /.test(data.error)) return data.error // e.g. daily-quota message
    return AI_BUSY_MSG
  }
  if (code === 'FETCH_FAILED') return FETCH_FAILED_MSG
  if (code === 'AI_INPUT_TOO_LARGE') return e.response?.data?.error || FETCH_FAILED_MSG // actionable (narrow date range)
  const status = e.response?.status
  const raw = `${e.response?.data?.error || ''} ${e.message || ''}`
  if (status === 429 || status === 503 || /429|503|rate limit|server busy|quota|too many|gemini/i.test(raw)) return AI_BUSY_MSG
  if (status === 400) return e.response?.data?.error || FETCH_FAILED_MSG // validation, user-fixable
  return FETCH_FAILED_MSG
}

// --- Results search + merge (ported from aylus/main.js) ---
// Merge lets users select 2+ volunteer rows and combine them into one
// ("Alice, Bob"), persisted per branch URL in localStorage.
const MERGE_STORAGE_PREFIX = 'aylus_merges'

function normalizeBranchKey(url) {
  const raw = String(url || '').trim()
  if (!raw) return 'default'
  try {
    const u = new URL(raw)
    const path = (u.pathname || '').replace(/\/+$/, '')
    return `${u.hostname.toLowerCase()}${path.toLowerCase()}`
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '')
  }
}

function mergeKeyFor(urlVal) {
  return `${MERGE_STORAGE_PREFIX}::${normalizeBranchKey(urlVal)}`
}

function loadMergesFor(urlVal) {
  try {
    const raw = localStorage.getItem(mergeKeyFor(urlVal))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m => m && typeof m.mergedName === 'string' && Array.isArray(m.members) && m.members.length >= 2)
  } catch {
    console.error('[HourCompiler] failed to read merges from localStorage')
    return []
  }
}

// entries: [{name, total, count}] -> with merged rows applied (members removed, combined row added)
function applyMergesToEntries(baseEntries, merges) {
  if (!merges || merges.length === 0) return baseEntries.map(e => ({ ...e }))
  const map = new Map(baseEntries.map(e => [e.name, { ...e }]))
  for (const m of merges) {
    const members = m.members
    const memberEntries = members.map(n => map.get(n)).filter(Boolean)
    // only apply if every member currently exists (skip partial/stale merges)
    if (memberEntries.length !== members.length) continue
    if (map.has(m.mergedName)) continue
    let totalCents = 0
    let count = 0
    for (const e of memberEntries) {
      totalCents += Math.round(e.total * 100)
      count += e.count
    }
    for (const n of members) map.delete(n)
    map.set(m.mergedName, { name: m.mergedName, total: totalCents / 100, count, merged: true, members: [...members] })
  }
  return Array.from(map.values())
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
  const [elapsedSeconds, setElapsedSeconds] = useState(null)
  const [expanded, setExpanded] = useState({}) // name -> bool
  const [resultQuery, setResultQuery] = useState('') // search within results
  const [selected, setSelected] = useState([]) // ordered selected volunteer names (for merge)
  const [mergeTick, setMergeTick] = useState(0) // bump to re-read merges from localStorage

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
    setErr(''); setData(null); setElapsedSeconds(null); setResultQuery(''); setSelected([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr(''); setData(null); setElapsedSeconds(null)
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
      setElapsedSeconds(Math.round(((Date.now() - t0) / 1000) * 10) / 10)
      console.log(`[HourCompiler] scrape completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      const payload = res.data
      const records = payload.data || payload.records || []
      setData(records)
      setExpanded({})
      if (records.length === 0) {
        setErr('No results found for this link and date range. Try a different link or a wider date range.')
      }
    } catch (e) {
      console.error('[HourCompiler] scrape failed', {
        url: url.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: e.response?.status,
        serverError: e.response?.data,
        message: e.message,
      })
      setErr(friendlyScrapeError(e))
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

  // group detailed records per volunteer for expandable rows
  const recordsByName = {}
  if (data) {
    for (const r of data) {
      if (!recordsByName[r.name]) recordsByName[r.name] = []
      recordsByName[r.name].push(r)
    }
    for (const k of Object.keys(recordsByName)) {
      recordsByName[k].sort((a, b) => String(b.date).localeCompare(String(a.date)))
    }
  }
  const toggleName = (name) => setExpanded(e => ({ ...e, [name]: !e[name] }))
  const expandAll = () => setExpanded(Object.fromEntries(visibleEntries.map(e => [e.name, true])))
  const collapseAll = () => setExpanded({})

  // merges persisted per branch URL (re-read when branch changes or after merge/reset)
  const merges = useMemo(() => loadMergesFor(url), [url, mergeTick])
  const mergedNameSet = useMemo(() => new Set(merges.map(m => m.mergedName)), [merges])

  // apply merges on top of totals, then re-sort by total desc
  const mergedEntries = useMemo(() => {
    const applied = applyMergesToEntries(
      sortedVolunteers.map(([name, hrs]) => ({ name, total: hrs, count: (recordsByName[name] || []).length })),
      merges,
    )
    applied.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    return applied
  }, [data, merges])

  // combined detail records for merged rows (members' records, newest first)
  const mergedRecordsByName = useMemo(() => {
    const out = {}
    for (const e of mergedEntries) {
      if (e.merged) {
        const rows = []
        for (const m of e.members || []) rows.push(...(recordsByName[m] || []))
        rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
        out[e.name] = rows
      } else {
        out[e.name] = recordsByName[e.name] || []
      }
    }
    return out
  }, [data, mergedEntries])

  // search within results (name, total hours, entry count)
  const rq = resultQuery.trim().toLowerCase()
  const visibleEntries = rq
    ? mergedEntries.filter(e => e.name.toLowerCase().includes(rq) || String(e.total).includes(rq) || String(e.count).includes(rq))
    : mergedEntries

  // selection pruned to rows that currently exist
  const nameSet = new Set(mergedEntries.map(e => e.name))
  const prunedSelected = selected.filter(n => nameSet.has(n))
  const toggleSelect = (name, checked) => setSelected(s => checked ? (s.includes(name) ? s : [...s, name]) : s.filter(n => n !== name))
  const toggleSelectAll = (checked) => setSelected(checked ? visibleEntries.map(e => e.name) : [])
  const canMerge = prunedSelected.length >= 2
  const canReset = prunedSelected.some(n => mergedNameSet.has(n))

  const handleMerge = () => {
    const entryMap = new Map(mergedEntries.map(e => [e.name, e]))
    const ordered = prunedSelected.filter(n => entryMap.has(n))
    if (ordered.length < 2) return
    const mergedName = ordered.join(', ')
    const existing = loadMergesFor(url)
    if (existing.some(m => m.mergedName === mergedName)) { setSelected([]); return }
    existing.push({ mergedName, members: ordered, createdAt: Date.now() })
    try {
      localStorage.setItem(mergeKeyFor(url), JSON.stringify(existing))
    } catch {
      console.error('[HourCompiler] failed to save merges to localStorage')
    }
    setSelected([])
    setExpanded(e => ({ ...e, [mergedName]: true }))
    setMergeTick(t => t + 1)
  }

  const handleResetMerged = () => {
    const all = loadMergesFor(url)
    if (all.length === 0 || prunedSelected.length === 0) return
    const sel = new Set(prunedSelected)
    const toRemove = new Set(all.filter(m => sel.has(m.mergedName)).map(m => m.mergedName))
    if (toRemove.size === 0) return
    // cascading: any merge built on a removed merged name goes too
    let changed = true
    while (changed) {
      changed = false
      for (const m of all) {
        if (toRemove.has(m.mergedName)) continue
        if (m.members.some(mem => toRemove.has(mem))) { toRemove.add(m.mergedName); changed = true }
      }
    }
    try {
      localStorage.setItem(mergeKeyFor(url), JSON.stringify(all.filter(m => !toRemove.has(m.mergedName))))
    } catch {
      console.error('[HourCompiler] failed to save merges to localStorage')
    }
    setSelected([])
    setMergeTick(t => t + 1)
  }

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
                <button className="btn btn-small btn-outline" onClick={() => downloadCsv(toCsv(visibleEntries.map(e => ({ name: e.name, hours: e.total, date: '', sourceUrl: '' }))), `aylus-totals-${Date.now()}.csv`)} disabled={data.length === 0}>Download Totals CSV</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginTop: 14 }}>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555', fontFamily:"'Mont', 'Montserrat', sans-serif" }}>Records</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000', fontFamily: "'Montserrat', sans-serif" }}>{data.length}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Volunteers</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000' }}>{mergedEntries.length}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Total Hours</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#000' }}>{totalHours}</div>
              </div>
              <div className="wire-card" style={{ padding: 14, textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#555' }}>Time Range</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#000', marginTop: 6 }}>{startDate || '—'} → {endDate || '—'}</div>
              </div>
            </div>

            {/* Hours — merged totals + details with expandable rows */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 20, marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontFamily: "'Mont', 'Montserrat', sans-serif", fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 }}>Hours by Volunteer</h4>
              {mergedEntries.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-small btn-outline" onClick={expandAll}>Expand all</button>
                  <button type="button" className="btn btn-small btn-outline" onClick={collapseAll}>Collapse all</button>
                </div>
              )}
            </div>
            {/* Search within results + merge controls */}
            {mergedEntries.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Search results (name, hours, count)..."
                  value={resultQuery}
                  onChange={e => setResultQuery(e.target.value)}
                  style={{ marginTop: 0, flex: '1 1 220px', maxWidth: 320 }}
                  aria-label="Search results"
                />
                {resultQuery && <button type="button" className="btn btn-small btn-outline" onClick={() => setResultQuery('')}>Clear</button>}
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-small btn-outline"
                  onClick={handleMerge}
                  disabled={!canMerge}
                  title={canMerge ? `Merge ${prunedSelected.length} selected volunteers` : 'Select at least 2 volunteers to merge'}
                >
                  Merge multiple{prunedSelected.length >= 2 ? ` (${prunedSelected.length})` : ''}
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-outline"
                  onClick={handleResetMerged}
                  disabled={!canReset}
                  title={canReset ? 'Split selected merged row(s) back to originals' : 'Select a merged row to reset'}
                >
                  Reset merged
                </button>
              </div>
            )}
            {rq && <p style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Showing {visibleEntries.length} of {mergedEntries.length} volunteer(s) for “{resultQuery.trim()}”.</p>}
            {mergedEntries.length === 0 ? (
              <div style={{ padding: 12, border: '1.5px dashed #111', textAlign: 'center', fontSize: 13, color: '#555', borderRadius: 12, background: 'white' }}>No totals to display.</div>
            ) : visibleEntries.length === 0 ? (
              <div style={{ padding: 12, border: '1.5px dashed #111', textAlign: 'center', fontSize: 13, color: '#555', borderRadius: 12, background: 'white' }}>No volunteers match “{resultQuery.trim()}”.</div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1.5px solid #111', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#111', color: 'white' }}>
                      <th style={{ padding: '8px 6px 8px 12px', width: 34 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all volunteers"
                          checked={visibleEntries.length > 0 && visibleEntries.every(e => prunedSelected.includes(e.name))}
                          ref={el => { if (el) el.indeterminate = prunedSelected.length > 0 && !visibleEntries.every(e => prunedSelected.includes(e.name)) }}
                          onChange={e => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, width: 36 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700 }}>Total Hours</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, width: 130 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry, i) => {
                      const { name } = entry
                      const hrs = entry.total
                      const isOpen = !!expanded[name]
                      const rows = mergedRecordsByName[name] || []
                      const isChecked = prunedSelected.includes(name)
                      return (
                        <React.Fragment key={name}>
                          <tr style={{ background: i % 2 === 0 ? 'white' : '#f7f7f7', borderTop: '1px solid #e5e5e5' }}>
                            <td style={{ padding: '7px 6px 7px 12px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => toggleSelect(name, e.target.checked)}
                                aria-label={`Select ${name}`}
                              />
                            </td>
                            <td style={{ padding: '7px 12px', color: '#555' }}>{i + 1}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600 }}>
                              {name} <span style={{ fontWeight: 400, color: '#777', fontSize: 12 }}>({rows.length} {rows.length === 1 ? 'entry' : 'entries'})</span>
                              {entry.merged && <span className="badge" style={{ marginLeft: 6 }}>Merged</span>}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{hrs}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-small btn-outline"
                                onClick={() => toggleName(name)}
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? 'Collapse' : 'Expand'} details for ${name}`}
                                style={{ minWidth: 96 }}
                              >
                                {isOpen ? '▾ Close' : '▸ Open'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: i % 2 === 0 ? 'white' : '#f7f7f7' }}>
                              <td colSpan={5} style={{ padding: '0 12px 12px' }}>
                                <div style={{ overflowX: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                      <tr style={{ background: '#f0f0f0' }}>
                                        <th style={{ textAlign: 'left', padding: '6px 10px' }}>Date</th>
                                        <th style={{ textAlign: 'right', padding: '6px 10px' }}>Hours</th>
                                        <th style={{ textAlign: 'left', padding: '6px 10px' }}>Source</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((r, j) => (
                                        <tr key={`${r.date}-${j}`} style={{ borderTop: '1px solid #eee' }}>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{r.date}</td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{r.hours}</td>
                                          <td style={{ padding: '6px 10px', maxWidth: 260, wordBreak: 'break-all' }}>
                                            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="wire-link" style={{ fontSize: 11 }}>{r.sourceUrl}</a>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
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
