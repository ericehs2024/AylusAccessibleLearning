import React, { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/AdminContext'

const CATEGORIES = ['all','powerpoints','lesson plans','teaching tips','worksheets','videos','other']

function isImageFile(url, type, name){
  const t = (type || '').toLowerCase()
  if(t.startsWith('image/')) return true
  const s = (url || name || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(s)
}

export default function Resources(){
  const { user, logout } = useAuth()
  const { isAdminAuthed, adminLogout } = useAdmin()
  const canView = !!user || isAdminAuthed
  const navigate = useNavigate()
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
          <h2 style={{marginBottom:6}}>Resources for branch admins</h2>
        </div>
        {user?.branchId && (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <Link to={`/branch/${user.branchId}/admin/resources`} className="btn btn-small">Manage Your Resources</Link>
            <button onClick={()=>{ logout(); adminLogout(); }} className="btn btn-small btn-outline">Log Out</button>
          </div>
        )}
        {!user && (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <Link to="/login" state={{ from: '/resources' }} className="btn btn-small">Branch Login</Link>
          </div>
        )}
      </div>

      {!user && (
        <div className="wire-card" style={{padding:20, marginTop:16, borderTop:'1px solid #e5e5e5'}}>
          <p style={{color:'#444', fontSize:14, marginBottom:12}}>Log in to view all resources or upload resources for your branch. Uploaded files (powerpoints, pdfs, videos, documents) instantly appear here searchable by titles or descriptions.</p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:12}}>
            <Link to="/login" state={{ from: '/resources' }} className="btn btn-small">Branch Login</Link>
            <Link to="/branches" className="btn btn-outline btn-small">All Branches</Link>
          </div>
        </div>
      )}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap'}}>
        <div>
          <p style={{color:'#5f6368', fontSize:14}}>Search uploaded powerpoints, lesson plans, teaching tips, and more from all branches.</p>
        </div>
      </div>
      {/* Search + Filters */}
      <div className="wire-card" style={{padding:16, marginTop:16}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <input className="input" placeholder="Search title, description..." value={q} onChange={e=>setQ(e.target.value)} style={{marginTop:0, flex:'1 1 260px'}} />
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
                border: `1.5px solid ${active ? '#b51c1c' : '#dd4444'}`,
                background: active ? '#dd4444' : 'white',
                color: active ? 'white' : '#b51c1c'
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
      {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, border:'1px solid #e5e5e5', borderTop:'3px solid #dd4444', marginTop:12}}>{err}</div>}

      <div style={{marginTop:16, display:'grid', gap:14, minHeight:280}}>
        {loading ? (
          <>
            <div className="wire-card" style={{padding:'16px 18px', height:148}}>
              <div style={{height:16, width:'45%', background:'#eee', borderRadius:4, marginBottom:12}} />
              <div style={{height:10, width:'65%', background:'#f0f0f0', borderRadius:4}} />
            </div>
            <div className="wire-card" style={{padding:'16px 18px', height:148}}>
              <div style={{height:16, width:'50%', background:'#eee', borderRadius:4, marginBottom:12}} />
              <div style={{height:10, width:'60%', background:'#f0f0f0', borderRadius:4}} />
            </div>
          </>
        ) : resources.length===0 ? (
          !canView ? (
            <div className="wire-card" style={{padding:20, textAlign:'center'}}>
              <p style={{fontSize:15, fontWeight:700, fontFamily:"'Montserrat', sans-serif", marginBottom:8}}>Please log in you branch to view resources.</p>
              <Link to="/login" state={{ from: '/resources' }} className="btn btn-small">Branch Login</Link>
            </div>
          ) : (
            <div className="wire-card" style={{padding:20, textAlign:'center', color:'#555'}}>
              No resources found. {user?.branchId ? <><Link to={`/branch/${user.branchId}/admin/resources`} className="wire-link">Upload one</Link> for your branch.</> : <>Try a different search or ask branch admins to upload.</>}
            </div>
          )
        ) : (
          resources.map(r=>(
          <div key={r.id} className="wire-card" style={{padding:'16px 18px'}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', alignItems:'flex-start'}}>
              <h3 style={{margin:0, fontSize:16, lineHeight:1.3}}>{r.title}</h3>
              <span className="badge" style={{whiteSpace:'nowrap'}}>{r.category}</span>
            </div>
            <div style={{fontSize:12, color:'#5f6368', margin:'6px 0 10px', display:'flex', gap:12, flexWrap:'wrap'}}>
              <span>Branch: <strong style={{color:'#000'}}>{r.branchName}</strong></span>
              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
              {canView && r.fileName && <span>File: {r.fileName}</span>}
            </div>
            {!canView ? (
              <div style={{margin:'10px 0', padding:'12px 14px', background:'#fff8f8', border:'1.5px solid #dd4444', borderRadius:4, textAlign:'center'}}>
                <span style={{fontSize:13, color:'#333', fontFamily:"'Lato', sans-serif"}}>Please log in you branch to view resources.</span>
              </div>
            ) : (
              <>
                {r.description && <p style={{fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:10}}>{r.description}</p>}
                {r.fileUrl && isImageFile(r.fileUrl, r.fileType, r.fileName) ? (
                  <div style={{marginBottom:10}}>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" title="Click to view full size">
                      <img src={r.fileUrl} alt={r.fileName || r.title} style={{width:'100%', maxHeight:420, objectFit:'contain', border:'1px solid #e5e5e5', background:'white', cursor:'zoom-in'}} loading="lazy" />
                    </a>
                    <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center'}}>
                      <span style={{fontSize:11, color:'#5f6368'}}>{r.fileName} — click image to view full size</span>
                      <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-small">Open full size</a>
                      <a href={r.fileUrl} download={r.fileName || ''} className="btn btn-small btn-outline">Download</a>
                    </div>
                  </div>
                ) : r.fileUrl ? (
                  <div style={{marginBottom:10}}>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-small"> {r.fileName ? `Download — ${r.fileName}` : 'Download file'}</a>
                  </div>
                ) : null}
              </>
            )}
            <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop: 8}}>
              <Link to={`/branch/${r.branchId}`} className="btn btn-small btn-outline">View Branch</Link>
            </div>
          </div>
        )))}
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
    </div>
  )
}
