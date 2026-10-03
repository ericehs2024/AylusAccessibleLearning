import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

function getTime(p) {
  const t = new Date(p.date).getTime()
  return Number.isNaN(t) ? null : t
}

function EventCard({ post, branchName, done }) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: -11,
          right: 12,
          zIndex: 2,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {done ? (
          <span className="badge" style={{ background: '#666' }}>Completed</span>
        ) : (
          <span className="badge">Upcoming</span>
        )}
      </div>
      <div style={done ? { opacity: 0.88, filter: 'saturate(0.6)' } : undefined}>
        <WirePostCard post={post} branchName={branchName} />
      </div>
    </div>
  )
}

export default function Events() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [needsVolunteersOnly, setNeedsVolunteersOnly] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = (searchParams.get('tab') || 'upcoming').toLowerCase()
  const tab = tabParam === 'past' || tabParam === 'all' ? tabParam : 'upcoming'

  useEffect(() => {
    api.get('/api/posts?limit=100').then(r => setPosts(r.data)).catch(e => console.error('[Events] GET /api/posts failed', e.response?.data || e.message)).finally(() => setLoading(false))
  }, [])

  const setTab = (t) => setSearchParams(t === 'upcoming' ? {} : { tab: t }, { replace: false })

  const { upcoming, past } = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const up = []
    const pa = []
    for (const p of posts) {
      const t = getTime(p)
      // No/invalid date -> treat as upcoming (don't silently hide), sorted last
      if (t === null || t >= startOfToday.getTime()) up.push(p)
      else pa.push(p)
    }
    up.sort((a, b) => (getTime(a) ?? Infinity) - (getTime(b) ?? Infinity))
    pa.sort((a, b) => (getTime(b) ?? 0) - (getTime(a) ?? 0))
    return { upcoming: up, past: pa }
  }, [posts])

  const q = applied.trim().toLowerCase()
  const needsVolunteers = (p) => p.volunteersNeeded != null && Number(p.volunteersNeeded) > 0
  const matchesQuery = (p) => {
    if (needsVolunteersOnly && !needsVolunteers(p)) return false
    if (!q) return true
    if (p.title && p.title.toLowerCase().includes(q)) return true
    if (p.branchName && p.branchName.toLowerCase().includes(q)) return true
    if (p.sections && p.sections.some(s => (s.text || '').toLowerCase().includes(q))) return true
    return false
  }
  const upcomingFiltered = upcoming.filter(matchesQuery)
  const pastFiltered = past.filter(matchesQuery)

  const doSearch = () => setApplied(query)
  const clear = () => { setQuery(''); setApplied(''); setNeedsVolunteersOnly(false) }

  if (loading) return <div className="container" style={{ padding: 40 }}>Loading events...</div>

  const listForTab = tab === 'past' ? pastFiltered : tab === 'all' ? [...upcomingFiltered, ...pastFiltered] : upcomingFiltered

  return (
    <div className="container" style={{ padding: '28px 20px', maxWidth: 1400 }}>
      <h2 style={{ marginBottom: 6 }}>Events</h2>
      <p style={{ color: '#5f6368', marginBottom: 16, fontSize: 14 }}>
        Upcoming events are open now. Completed events stay visible below for reference.
      </p>

      <div className="tabs" role="tablist" aria-label="Event filters">
        <button role="tab" aria-selected={tab === 'upcoming'} className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({upcomingFiltered.length})
        </button>
        <button role="tab" aria-selected={tab === 'past'} className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Completed ({pastFiltered.length})
        </button>
        <button role="tab" aria-selected={tab === 'all'} className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All ({upcomingFiltered.length + pastFiltered.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 520, alignItems: 'center' }}>
        <input className="input" placeholder="Search events (title or text)..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} style={{ flex: 1, marginTop: 0 }} />
        <button className="btn btn-small" onClick={doSearch} style={{ cursor: 'pointer' }}>Search</button>
        {(query || applied || needsVolunteersOnly) && <button className="btn btn-small btn-outline" onClick={clear} style={{ cursor: 'pointer' }}>Clear</button>}
      </div>
      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 18, cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={needsVolunteersOnly} onChange={e => setNeedsVolunteersOnly(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#dd4444' }} />
        🙋 Only show events needing volunteers
      </label>
      {(applied || needsVolunteersOnly) && <p style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Showing {listForTab.length} result(s){applied ? ` for “${applied}”` : ''}{needsVolunteersOnly ? ' needing volunteers' : ''}.</p>}

      {tab === 'all' ? (
        <>
          <h3 style={{ margin: '6px 0 12px' }}>Upcoming ({upcomingFiltered.length})</h3>
          {upcomingFiltered.length === 0
            ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No upcoming events{applied ? ` match "${applied}"` : ''}.</div>
            : upcomingFiltered.map(p => <EventCard key={p.id} post={p} branchName={p.branchName} done={false} />)}
          <div className="divider" />
          <h3 style={{ margin: '6px 0 12px' }}>Completed ({pastFiltered.length})</h3>
          {pastFiltered.length === 0
            ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No completed events{applied ? ` match "${applied}"` : ''} yet.</div>
            : pastFiltered.map(p => <EventCard key={p.id} post={p} branchName={p.branchName} done />)}
        </>
      ) : tab === 'past' ? (
        pastFiltered.length === 0
          ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No completed events{applied ? ` match "${applied}"` : ''} yet.</div>
          : pastFiltered.map(p => <EventCard key={p.id} post={p} branchName={p.branchName} done />)
      ) : (
        upcomingFiltered.length === 0
          ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No upcoming events{applied ? ` match "${applied}"` : ''}. Check Completed.</div>
          : upcomingFiltered.map(p => <EventCard key={p.id} post={p} branchName={p.branchName} done={false} />)
      )}
    </div>
  )
}
