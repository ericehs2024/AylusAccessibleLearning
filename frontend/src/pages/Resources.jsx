import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const CATEGORIES = ['all','powerpoints','lesson plans','teaching tips','worksheets','videos','other']

function isImageFile(url, type, name){
  const t = (type || '').toLowerCase()
  if(t.startsWith('image/')) return true
  const s = (url || name || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(s)
}

export default function Resources(){
  const { user } = useAuth()
  const { isDark } = (()=>{ try{ return useTheme() } catch{ return {isDark:false} } })()
  const [searchParams] = useSearchParams()
  const initialBranch = searchParams.get('branch') || 'all'
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [branchId, setBranchId] = useState(initialBranch)
  const [branches, setBranches] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(()=>{
    api.get('/api/branches').then(r=>setBranches(r.data)).catch(()=>{})
  },[])

  useEffect(()=>{
    const b = searchParams.get('branch')
    if(b) setBranchId(b)
  },[searchParams])

  const fetchResources = async (overrides = {})=>{
    const params = {
      q: overrides.q !== undefined ? overrides.q : q,
      category: overrides.category !== undefined ? overrides.category : category,
      branchId: overrides.branchId !== undefined ? overrides.branchId : branchId,
    }
    setLoading(true); setErr('')
    try{
      const query = new URLSearchParams()
      if(params.q && params.q.trim()) query.set('q', params.q.trim())
      if(params.category && params.category !== 'all') query.set('category', params.category)
      if(params.branchId && params.branchId !== 'all') query.set('branchId', params.branchId)
      query.set('limit','100')
      const res = await api.get(`/api/resources?${query.toString()}`)
      setResources(res.data)
    }catch(e){ setErr(e.response?.data?.error || 'Failed to load resources')}
    finally{ setLoading(false)}
  }

  // initial load + when category/branch change
  useEffect(()=>{ fetchResources() },[category, branchId])
  // debounced search for q
  useEffect(()=>{
    const t = setTimeout(()=> fetchResources(), 400)
    return ()=> clearTimeout(t)
  },[q])

  const clearFilters = ()=>{
    setQ(''); setCategory('all'); setBranchId('all')
    // fetch will run via effects
  }

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap'}}>
        <div>
          <h2 style={{marginBottom:6}}>Resources</h2>
          <p style={{color:'#5f6368', fontSize:14}}>Search uploaded powerpoints, lesson plans, teaching tips, and more from all branches. Filter by label.</p>
        </div>
        {user?.branchId && (
          <Link to={`/branch/${user.branchId}/admin/resources`} className="btn btn-small">Manage Your Resources</Link>
        )}
      </div>

      {/* Search + Filters */}
      <div className="wire-card" style={{padding:16, marginTop:16}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <input className="input" placeholder="Search title, description, file name..." value={q} onChange={e=>setQ(e.target.value)} style={{marginTop:0, flex:'1 1 260px'}} />
          <select className="select" value={category} onChange={e=>setCategory(e.target.value)} style={{marginTop:0, flex:'0 1 180px'}}>
            {CATEGORIES.map(c=> <option key={c} value={c}>{c === 'all' ? 'All labels' : c}</option>)}
          </select>
          <select className="select" value={branchId} onChange={e=>setBranchId(e.target.value)} style={{marginTop:0, flex:'0 1 200px'}}>
            <option value="all">All branches</option>
            {branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:12, alignItems:'center'}}>
          <span style={{fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Quick filters:</span>
          {CATEGORIES.map(c=>{
            const active = category===c
            return (
              <button key={c} onClick={()=>setCategory(c)} className="badge" style={{
                cursor:'pointer',
                border: `1.5px solid ${isDark ? (active ? '#e6e6e6' : '#555') : '#111'}`,
                background: active ? (isDark ? '#e6e6e6' : '#111') : (isDark ? '#2a2a2a' : 'white'),
                color: active ? (isDark ? '#111' : 'white') : (isDark ? '#e6e6e6' : '#111')
              }}>{c}</button>
            )
          })}
          <button className="btn btn-small btn-outline" onClick={clearFilters} style={{marginLeft:8}}>Clear</button>
          <button className="btn btn-small" onClick={()=>fetchResources()} disabled={loading} style={{marginLeft:'auto'}}>{loading ? 'Searching...' : 'Search'}</button>
        </div>
        <div style={{fontSize:12, color:'#5f6368', marginTop:8}}>
          {loading ? 'Loading...' : `${resources.length} result${resources.length!==1?'s':''} ${q || category!=='all' || branchId!=='all' ? 'for current filters' : ''}`}
        </div>
      </div>

      {/* Results */}
      {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, border:'3px solid #000', marginTop:12}}>{err}</div>}

      <div style={{marginTop:16, display:'grid', gap:14}}>
        {!loading && resources.length===0 && (
          <div className="wire-card" style={{padding:20, textAlign:'center', color:'#555'}}>
            No resources found. {user?.branchId ? <><Link to={`/branch/${user.branchId}/admin/resources`} className="wire-link">Upload one</Link> for your branch.</> : <>Try a different search or ask branch admins to upload.</>}
          </div>
        )}
        {resources.map(r=>(
          <div key={r.id} className="wire-card" style={{padding:'16px 18px'}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', alignItems:'flex-start'}}>
              <h3 style={{margin:0, fontSize:16, lineHeight:1.3}}>{r.title}</h3>
              <span className="badge" style={{background:'#000', whiteSpace:'nowrap'}}>{r.category}</span>
            </div>
            <div style={{fontSize:12, color:'#5f6368', margin:'6px 0 10px', display:'flex', gap:12, flexWrap:'wrap'}}>
              <span>Branch: <strong style={{color:'#000'}}>{r.branchName}</strong></span>
              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              {r.fileName && <span>File: {r.fileName}</span>}
            </div>
            {r.description ? <p style={{fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:10}}>{r.description}</p> : <p style={{fontSize:13, color:'#777', fontStyle:'italic', marginBottom:10}}>No typed description — see file below.</p>}
            {r.fileUrl && isImageFile(r.fileUrl, r.fileType, r.fileName) ? (
              <div style={{marginBottom:10}}>
                <a href={r.fileUrl} target="_blank" rel="noreferrer" title="Click to view full size">
                  <img src={r.fileUrl} alt={r.fileName || r.title} style={{width:'100%', maxHeight:420, objectFit:'contain', border:'2px solid #000', background:'white', cursor:'zoom-in'}} loading="lazy" />
                </a>
                <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center'}}>
                  <span style={{fontSize:11, color:'#5f6368'}}>{r.fileName} — click image to view full size</span>
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" style={{fontSize:12, textDecoration:'underline', color:'#000', fontWeight:700}}>Open full size</a>
                  <a href={r.fileUrl} download={r.fileName || ''} style={{fontSize:12, textDecoration:'underline', color:'#000'}}>Download</a>
                </div>
              </div>
            ) : r.fileUrl ? (
              <div style={{marginBottom:10}}>
                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="wire-nav-item" style={{fontSize:12, padding:'7px 12px'}}>{r.fileName ? `Download — ${r.fileName}` : 'Download file'}</a>
              </div>
            ) : null}
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {!r.fileUrl && <span style={{fontSize:12, color:'#777', border:'2px solid #000', padding:'6px 10px', background:'white'}}>Typed resource only</span>}
              <Link to={`/branch/${r.branchId}`} className="btn btn-small btn-outline">View Branch</Link>
            </div>
          </div>
        ))}
      </div>

      {/* Static guides */}
      <div className="wire-card" style={{padding:20, marginTop:24}}>
        <h3 style={{marginBottom:10}}>Tutoring & Accessibility Guides</h3>
        <ul style={{lineHeight:1.9, paddingLeft:18}}>
          <li><a href="https://www.w3.org/WAI/" target="_blank" rel="noreferrer">W3C Web Accessibility Initiative (WAI)</a> — accessibility fundamentals</li>
          <li><a href="https://www.khanacademy.org" target="_blank" rel="noreferrer">Khan Academy</a> — free lessons for tutors to share</li>
          <li><a href="https://aylus.org" target="_blank" rel="noreferrer">AYLUS.org</a> — main organization site</li>
        </ul>
      </div>

      {!user && (
        <div className="wire-card" style={{padding:20}}>
          <h3 style={{marginBottom:10}}>For Branch Admins</h3>
          <p style={{color:'#444', fontSize:14, marginBottom:12}}>Log in to upload resources for your branch. Uploaded files (powerpoints, pdfs, videos, documents) instantly appear here searchable by label.</p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Link to="/login" className="btn btn-small">Branch Login</Link>
            <Link to="/branches" className="btn btn-outline btn-small">All Branches</Link>
          </div>
        </div>
      )}
    </div>
  )
}
