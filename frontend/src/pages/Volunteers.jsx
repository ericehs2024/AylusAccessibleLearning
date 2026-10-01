import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

function getTime(p) {
  const t = new Date(p.date).getTime()
  return Number.isNaN(t) ? null : t
}

function needsVolunteers(p) {
  return p.volunteersNeeded != null && Number(p.volunteersNeeded) > 0
}

function isClosed(p) {
  return (p.volunteerStatus || '').toLowerCase() === 'closed'
}

function isPast(p) {
  const t = getTime(p)
  if (t === null) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return t < startOfToday.getTime()
}

function OpportunityCard({ post, branchName }) {
  const closed = isClosed(post)
  const done = closed || isPast(post)
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 14,
          zIndex: 2,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {closed ? (
          <span className="badge" style={{ background: '#666' }}>Closed — filled</span>
        ) : isPast(post) ? (
          <span className="badge" style={{ background: '#666' }}>Completed</span>
        ) : (
          <span className="badge">🙋 {post.volunteersNeeded} needed · Open</span>
        )}
      </div>
      <div style={done ? { opacity: 0.88, filter: 'saturate(0.6)' } : undefined}>
        <WirePostCard post={post} branchName={branchName} />
      </div>
    </div>
  )
}

export default function Volunteers() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = (searchParams.get('tab') || 'open').toLowerCase()
  // status tabs: open (default) | closed | all — legacy date params map in
  const tab = rawTab === 'closed' ? 'closed' : rawTab === 'all' || rawTab === 'past' ? 'all' : 'open'

  useEffect(() => {
    api.get('/api/posts?limit=100').then(r => setPosts(r.data)).catch(e => console.error('[Volunteers] GET /api/posts failed', e.response?.data || e.message)).finally(() => setLoading(false))
  }, [])

  const setTab = (t) => setSearchParams(t === 'open' ? {} : { tab: t }, { replace: false })

  // Only events with volunteersNeeded > 0 automatically appear here —
  // a headcount > 0 flips a blank status to Open; organizers close it when filled.
  // Legacy rows with a headcount but blank status count as open.
  const { open, closed } = useMemo(() => {
    const op = []
    const cl = []
    for (const p of posts) {
      if (!needsVolunteers(p)) continue
      if (isClosed(p)) cl.push(p)
      else op.push(p)
    }
    op.sort((a, b) => (getTime(a) ?? Infinity) - (getTime(b) ?? Infinity))
    cl.sort((a, b) => (getTime(b) ?? 0) - (getTime(a) ?? 0))
    return { open: op, closed: cl }
  }, [posts])

  const q = applied.trim().toLowerCase()
  const matchesQuery = (p) => {
    if (!q) return true
    if (p.title && p.title.toLowerCase().includes(q)) return true
    if (p.branchName && p.branchName.toLowerCase().includes(q)) return true
    if (p.location && p.location.toLowerCase().includes(q)) return true
    if (p.sections && p.sections.some(s => (s.text || '').toLowerCase().includes(q))) return true
    return false
  }
  const openFiltered = open.filter(matchesQuery)
  const closedFiltered = closed.filter(matchesQuery)

  const doSearch = () => setApplied(query)
  const clear = () => { setQuery(''); setApplied('') }

  if (loading) return <div className="container" style={{ padding: 40 }}>Loading volunteer opportunities...</div>

  const listForTab = tab === 'closed' ? closedFiltered : tab === 'all' ? [...openFiltered, ...closedFiltered] : openFiltered

  return (
    <div className="container" style={{ padding: '28px 20px' }}>
      <h2 style={{ marginBottom: 6 }}>Volunteer Opportunities</h2>
      <p style={{ color: '#5f6368', marginBottom: 16, fontSize: 14 }}>
        Events that need volunteers show up here automatically — set <strong>Volunteers needed &gt; 0</strong> and the status flips to <strong>Open</strong>. Close it when the spots are filled.
      </p>

      <div className="tabs" role="tablist" aria-label="Volunteer opportunity filters">
        <button role="tab" aria-selected={tab === 'open'} className={`tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
          Open ({openFiltered.length})
        </button>
        <button role="tab" aria-selected={tab === 'closed'} className={`tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
          Closed ({closedFiltered.length})
        </button>
        <button role="tab" aria-selected={tab === 'all'} className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All ({openFiltered.length + closedFiltered.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, maxWidth: 520, alignItems: 'center' }}>
        <input className="input" placeholder="Search opportunities (title, branch, location)..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} style={{ flex: 1, marginTop: 0 }} />
        <button className="btn btn-small" onClick={doSearch} style={{ cursor: 'pointer' }}>Search</button>
        {(query || applied) && <button className="btn btn-small btn-outline" onClick={clear} style={{ cursor: 'pointer' }}>Clear</button>}
      </div>
      {applied && <p style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Showing {listForTab.length} result(s) for “{applied}”.</p>}

      {tab === 'all' ? (
        <>
          <h3 style={{ margin: '6px 0 12px' }}>Open ({openFiltered.length})</h3>
          {openFiltered.length === 0
            ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No open volunteer opportunities{applied ? ` match "${applied}"` : ''} yet.</div>
            : openFiltered.map(p => <OpportunityCard key={p.id} post={p} branchName={p.branchName} />)}
          <div className="divider" />
          <h3 style={{ margin: '6px 0 12px' }}>Closed ({closedFiltered.length})</h3>
          {closedFiltered.length === 0
            ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No closed opportunities{applied ? ` match "${applied}"` : ''}.</div>
            : closedFiltered.map(p => <OpportunityCard key={p.id} post={p} branchName={p.branchName} />)}
        </>
      ) : tab === 'closed' ? (
        closedFiltered.length === 0
          ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>No closed opportunities{applied ? ` match "${applied}"` : ''}.</div>
          : closedFiltered.map(p => <OpportunityCard key={p.id} post={p} branchName={p.branchName} />)
      ) : (
        openFiltered.length === 0
          ? <div className="wire-card" style={{ padding: 24, textAlign: 'center' }}>
              No open volunteer opportunities{applied ? ` match "${applied}"` : ''}. <Link to="/events" className="wire-link">Browse all events</Link>.
            </div>
          : openFiltered.map(p => <OpportunityCard key={p.id} post={p} branchName={p.branchName} />)
      )}
    </div>
  )
}
