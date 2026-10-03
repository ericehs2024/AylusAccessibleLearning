import React, { useState, useEffect } from 'react'
import api from '../api'
import PasswordInput from '../components/PasswordInput'
import { useAdmin } from '../context/AdminContext'
import { trackEvent } from '../utils/analytics'

function toDayMap(rows) {
  const m = {}
  for (const r of rows || []) m[r.day] = r.count
  return m
}

function lastNDays(n) {
  const out = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 1)
  }
  return out
}

function AnalyticsSummary({ data, days }) {
  const pvMap = toDayMap(data.dailyPageviews)
  const pwMap = toDayMap(data.dailyPasswordChanges)
  const adMap = toDayMap(data.dailyAdminLogins)
  const totalPv = (data.dailyPageviews || []).reduce((s, r) => s + r.count, 0)
  const totalPw = (data.dailyPasswordChanges || []).reduce((s, r) => s + r.count, 0)
  const totalAd = (data.dailyAdminLogins || []).reduce((s, r) => s + r.count, 0)
  const recentDays = lastNDays(Math.min(days, 14))
  const card = { border: '1px solid #000', borderRadius: 4, padding: '10px 12px', textAlign: 'center', flex: '1 1 140px', background: '#fff' }
  const th = { padding: '8px 6px', textAlign: 'left', borderBottom: '3px solid #000' }
  const td = { padding: '8px 6px', borderBottom: '1px solid #000' }
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#555' }}>Pageviews ({days}d)</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalPv}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#555' }}>Password changes ({days}d)</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalPw}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#555' }}>Admin logins ({days}d)</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalAd}</div>
        </div>
      </div>

      <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Daily activity (last {recentDays.length} days)</h4>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>Day</th>
              <th style={{ ...th, textAlign: 'right' }}>Pageviews</th>
              <th style={{ ...th, textAlign: 'right' }}>Pw changes</th>
              <th style={{ ...th, textAlign: 'right' }}>Admin logins</th>
            </tr>
          </thead>
          <tbody>
            {recentDays.map(day => (
              <tr key={day}>
                <td style={td}>{day}</td>
                <td style={{ ...td, textAlign: 'right' }}>{pvMap[day] || 0}</td>
                <td style={{ ...td, textAlign: 'right' }}>{pwMap[day] || 0}</td>
                <td style={{ ...td, textAlign: 'right' }}>{adMap[day] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div>
          <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Most active branches ({days}d)</h4>
          {(data.topBranches || []).length === 0 && <div style={{ fontSize: 12, color: '#555' }}>No branch activity yet.</div>}
          {(data.topBranches || []).length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Branch</th>
                  <th style={{ ...th, textAlign: 'right' }}>Events</th>
                </tr>
              </thead>
              <tbody>
                {data.topBranches.map(b => (
                  <tr key={b.branchId}>
                    <td style={td}>{b.branchName}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Most used pages ({days}d)</h4>
          {(data.topPages || []).length === 0 && <div style={{ fontSize: 12, color: '#555' }}>No pageviews yet.</div>}
          {(data.topPages || []).length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Page</th>
                  <th style={{ ...th, textAlign: 'right' }}>Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map(p => (
                  <tr key={p.path}>
                    <td style={{ ...td, wordBreak: 'break-all' }}>{p.path}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Admin(){
  const { adminToken, adminLogin, adminLogout, isAdminAuthed } = useAdmin()
  const [adminUsername, setAdminUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [listErr, setListErr] = useState('')

  // new branch form
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [branchPassword, setBranchPassword] = useState('')
  const [createErr, setCreateErr] = useState('')
  const [createOk, setCreateOk] = useState('')
  const [creating, setCreating] = useState(false)

  // site analytics (last N days)
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsErr, setAnalyticsErr] = useState('')

  // search existing branches
  const [branchQuery, setBranchQuery] = useState('')

  const isAuthed = isAdminAuthed

  const fetchBranches = async () => {
    if(!adminToken) return
    setBranchLoading(true)
    setListErr('')
    try{
      // api.js interceptor will attach correct admin token (aylus_admin_token), never branch token
      const res = await api.get('/api/admin/branches')
      setBranches(res.data)
    }catch(e){
      const msg = e.response?.data?.error || 'Failed to load branches'
      setListErr(msg)
      if(e.response?.status === 401 || e.response?.status === 403){
        // admin token invalid/expired -> force re-login, but do NOT touch branch session
        adminLogout()
      }
    }finally{ setBranchLoading(false)}
  }

  useEffect(()=>{
    if(adminToken) fetchBranches()
  }, [adminToken])

  const fetchAnalytics = async (days) => {
    setAnalyticsLoading(true)
    setAnalyticsErr('')
    try{
      const res = await api.get(`/api/admin/analytics?days=${days}`)
      setAnalytics(res.data)
    }catch(e){
      setAnalyticsErr(e.response?.data?.error || 'Failed to load analytics')
      console.error('[Admin] GET /api/admin/analytics failed', e.response?.data || e.message)
    }finally{ setAnalyticsLoading(false)}
  }

  useEffect(()=>{
    if(adminToken) fetchAnalytics(analyticsDays)
  }, [adminToken])

  const handleLogin = async (e)=>{
    e.preventDefault()
    setErr(''); setLoading(true)
    if(!adminUsername.trim() || !password){
      setErr('Username and password required')
      setLoading(false)
      return
    }
    try{
      const res = await api.post('/api/admin/login', { username: adminUsername.trim(), password })
      const t = res.data.token
      adminLogin(t)
      trackEvent('admin_login')
      setPassword('')
    }catch(ex){
      setErr(ex.response?.data?.error || 'Invalid credentials')
    }finally{ setLoading(false)}
  }

  const handleLogout = ()=>{
    adminLogout()
    setBranches([])
  }

  const toggleFeatured = async (b)=>{
    try{
      const res = await api.put(`/api/admin/branches/${b.id}/featured`, { featured: !b.featured })
      setBranches(prev => prev.map(x => x.id === b.id ? { ...x, featured: res.data.featured } : x))
    }catch(ex){
      console.error(`[Admin] PUT /api/admin/branches/${b.id}/featured failed`, ex.response?.data || ex.message)
      setListErr(ex.response?.data?.error || 'Failed to update featured flag')
    }
  }

  const handleCreate = async (e)=>{
    e.preventDefault()
    setCreateErr(''); setCreateOk('')
    if(!name.trim() || !username.trim() || !branchPassword){
      setCreateErr('Name, username and password are required')
      return
    }
    setCreating(true)
    try{
      // interceptor attaches admin token automatically
      const res = await api.post('/api/admin/branches', {
        name: name.trim(),
        username: username.trim(),
        password: branchPassword
      })
      setCreateOk(`Branch "${res.data.name}" created (username: ${res.data.username})`)
      setName(''); setUsername(''); setBranchPassword('')
      fetchBranches()
    }catch(ex){
      setCreateErr(ex.response?.data?.error || 'Failed to create branch')
    }finally{ setCreating(false)}
  }

  // --- Login gate (username + password) ---
  if(!isAuthed){
    return (
      <div className="container" style={{maxWidth:460, padding:'60px 20px'}}>
        <h2 style={{marginBottom:8}}>Admin</h2>
        <p style={{color:'#5f6368', fontSize:13, marginBottom:18}}>Enter admin username and password to access control panel. Distinct from branch logins.</p>
        <form onSubmit={handleLogin} className="card">
          {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:4, marginBottom:12, fontSize:14, border:'2px solid #000'}}>{err}</div>}
          <label className="label">Username</label>
          <input className="input" value={adminUsername} onChange={e=>setAdminUsername(e.target.value)} placeholder="admin" autoFocus style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Password</label>
          <PasswordInput value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{borderWidth:3, borderColor:'#000'}} />
          <button className="btn" style={{marginTop:16, width:'100%', justifyContent:'center', border:'3px solid #000'}} disabled={loading}>{loading ? 'Verifying...' : 'Enter'}</button>
        </form>
      </div>
    )
  }

  // --- Admin control panel ---
  return (
    <div className="container" style={{maxWidth:860, padding:'24px 20px 40px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16}}>
        <h2 style={{borderLeft:'4px solid #000', paddingLeft:10}}>Admin Control Panel</h2>
        <button className="btn btn-outline" onClick={handleLogout} style={{borderWidth:3, borderColor:'#000', color:'#000'}}>Log out</button>
      </div>

      <div className="wire-card" style={{marginBottom:20}}>
        <h3 style={{fontFamily:'Arial, Helvetica, sans-serif', fontSize:14, fontWeight:800, marginBottom:6}}>Add New Branch</h3>
        <p style={{fontSize:12, color:'#333', marginBottom:14}}>Create a branch with a display name, login username and password. Branches appear under “All branches”.</p>
        <form onSubmit={handleCreate}>
          {createErr && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:0, marginBottom:12, fontSize:13, border:'3px solid #000'}}>{createErr}</div>}
          {createOk && <div style={{background:'#e6f4ea', color:'#137333', padding:10, borderRadius:0, marginBottom:12, fontSize:13, border:'3px solid #000'}}>{createOk}</div>}
          <label className="label">Branch Name</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Aylus - Great Neck" style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Username (login)</label>
          <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. greatneck" style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Password</label>
          <PasswordInput value={branchPassword} onChange={e=>setBranchPassword(e.target.value)} placeholder="••••••••" style={{borderWidth:3, borderColor:'#000'}} />
          <button className="btn" style={{marginTop:16, border:'3px solid #000'}} disabled={creating}>{creating ? 'Creating...' : 'Add Branch'}</button>
        </form>
      </div>

      <div className="wire-card" style={{marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6}}>
          <h3 style={{fontFamily:'Arial, Helvetica, sans-serif', fontSize:14, fontWeight:800, margin:0}}>Site Analytics</h3>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <label className="label" htmlFor="analytics-days" style={{margin:0}}>Range</label>
            <select
              id="analytics-days"
              className="select"
              value={analyticsDays}
              onChange={e=>{ const d = Number(e.target.value); setAnalyticsDays(d); fetchAnalytics(d) }}
              style={{marginTop:0, width:'auto', padding:'6px 8px'}}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
        <p style={{fontSize:12, color:'#333', marginBottom:14}}>Daily pageviews, branch password changes, admin logins, most active branches and most used pages. Session replays and heatmaps live in the Microsoft Clarity dashboard.</p>
        {analyticsLoading && <div style={{fontSize:13, color:'#555'}}>Loading analytics...</div>}
        {analyticsErr && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, fontSize:13, border:'3px solid #000', marginBottom:10}}>{analyticsErr}</div>}
        {analytics && !analyticsLoading && (
          <AnalyticsSummary data={analytics} days={analyticsDays} />
        )}
      </div>

      <div className="wire-card">
        <h3 style={{fontFamily:'Arial, Helvetica, sans-serif', fontSize:14, fontWeight:800, marginBottom:10}}>Existing Branches ({branches.length})</h3>
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
          <input
            className="input"
            placeholder="Search branches (name, username, email)..."
            value={branchQuery}
            onChange={e=>setBranchQuery(e.target.value)}
            style={{marginTop:0, flex:'1 1 220px', maxWidth:340}}
            aria-label="Search existing branches"
          />
          {branchQuery && <button type="button" className="btn btn-small btn-outline" onClick={()=>setBranchQuery('')}>Clear</button>}
        </div>
        {branchLoading && <div style={{fontSize:13, color:'#555'}}>Loading branches...</div>}
        {listErr && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, fontSize:13, border:'3px solid #000', marginBottom:10}}>{listErr}</div>}
        {!branchLoading && !listErr && branches.length === 0 && <div style={{fontSize:13, color:'#555'}}>No branches yet.</div>}
        {!branchLoading && !listErr && branches.length > 0 && (() => {
          const q = branchQuery.trim().toLowerCase()
          const filtered = q
            ? branches.filter(b => [b.name, b.username, b.email, b.id].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
            : branches
          if (filtered.length === 0) return <div style={{fontSize:13, color:'#555'}}>No branches match “{branchQuery.trim()}”.</div>
          return (
          <>
          {q && <p style={{fontSize:12, color:'#555', marginBottom:8}}>Showing {filtered.length} of {branches.length} branch(es) for “{branchQuery.trim()}”.</p>}
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{textAlign:'left', borderBottom:'3px solid #000'}}>
                  <th style={{padding:'8px 6px'}}>Branch Name</th>
                  <th style={{padding:'8px 6px'}}>Username</th>
                  <th style={{padding:'8px 6px'}}>Email</th>
                  <th style={{padding:'8px 6px'}}>Featured</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b=> (
                  <tr key={b.id} style={{borderBottom:'1px solid #000'}}>
                    <td style={{padding:'8px 6px', fontWeight:700}}>{b.name}</td>
                    <td style={{padding:'8px 6px'}}>{b.username}</td>
                    <td style={{padding:'8px 6px'}}>{b.email || '—'}</td>
                    <td style={{padding:'8px 6px'}}>
                      <label style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12}}>
                        <input type="checkbox" checked={!!b.featured} onChange={()=>toggleFeatured(b)} aria-label={`Featured: ${b.name}`} />
                        {b.featured ? 'Yes' : 'No'}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )
        })()}
      </div>
    </div>
  )
}
