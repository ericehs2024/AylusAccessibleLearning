import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Branches(){
  const { user } = useAuth()
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [myBranch, setMyBranch] = useState(null)

  useEffect(()=>{
    api.get('/api/branches').then(r=>setBranches(r.data)).catch(e=>console.error('[Branches] GET /api/branches failed', e.response?.data || e.message)).finally(()=>setLoading(false))
  },[])

  useEffect(()=>{
    if (user?.branchId) {
      api.get(`/api/branches/${user.branchId}`).then(r=>setMyBranch(r.data)).catch(e=>{ console.error(`[Branches] GET /api/branches/${user.branchId} failed`, e.response?.data || e.message); setMyBranch(null) })
    } else {
      setMyBranch(null)
    }
  },[user?.branchId])

  if(loading) return <div className="container" style={{padding:40}}>Loading branches...</div>

  const filtered = q.trim() ? branches.filter(b=> b.name.toLowerCase().includes(q.trim().toLowerCase())) : branches
  const featured = branches.filter(b=> b.featured)

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      {/* My Branch — pinned at top */}
      <section id="my-branch" aria-label="My branch" style={{scrollMarginTop:70}}>
        <h2 style={{marginBottom:6}}>My Branch</h2>
        {user?.branchId && myBranch ? (
          <div className="wire-card" style={{padding:18}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <div>
                <span className="badge">My branch</span>
                <h3 style={{margin:'8px 0 4px', fontSize:17}}>{myBranch.name}</h3>
                <p style={{color:'#5f6368', fontSize:13, margin:0}}>Logged in as {user.username} — manage your page, posts and resources.</p>
              </div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                <Link to={`/branch/${myBranch.id}`} className="btn btn-small">View Branch</Link>
                <Link to={`/branch/${myBranch.id}/posts`} className="btn btn-small btn-outline">Posts</Link>
                <Link to={`/branch/${myBranch.id}/admin/resources`} className="btn btn-small btn-outline">Manage</Link>
              </div>
            </div>
          </div>
        ) : user?.branchId ? (
          <div className="wire-card" style={{padding:18}}>
            <p style={{fontSize:14, margin:'0 0 10px'}}>Logged in — loading your branch…</p>
            <Link to={`/branch/${user.branchId}`} className="btn btn-small">Go to My Branch</Link>
          </div>
        ) : (
          <div className="wire-card" style={{padding:18}}>
            <p style={{color:'#5f6368', margin:'0 0 12px', fontSize:14}}>You are not logged in. Log in to manage your branch.</p>
            <Link to="/login" className="btn btn-small">Admin Login</Link>
          </div>
        )}
      </section>

      <div className="divider" />

      {/* Featured Branches — only shown when at least one branch is marked featured */}
      {featured.length > 0 && (
        <>
          <section id="featured-branches" aria-label="Featured branches" style={{scrollMarginTop:70}}>
            <h2 style={{marginBottom:6}}>Featured Branches</h2>
            <p style={{color:'#333', marginBottom:16, fontSize:14, fontFamily:"'Lato', sans-serif"}}>Spotlight branches making a big impact in accessible learning.</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16}}>
              {featured.map(b=>{
                const isMine = user?.branchId === b.id
                return (
                  <div key={b.id} className="wire-card" style={{display:'flex', flexDirection:'column', padding:16, marginBottom:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                      <h3 style={{fontSize:15, fontFamily:"'Montserrat', sans-serif", color:'#222', margin:0}}>{b.name}</h3>
                      <span className="badge">Featured</span>
                      {isMine && <span className="badge">My branch</span>}
                    </div>
                    <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                      <Link to={`/branch/${b.id}`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>View Branch</Link>
                      <Link to={`/branch/${b.id}/posts`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>Posts</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="divider" />
        </>
      )}

      {/* All Branches — scroll down section */}
      <section id="all-branches" aria-label="All branches" style={{scrollMarginTop:70}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6}}>
          <h2 style={{margin:0, fontFamily:"'Montserrat', sans-serif"}}>All Branches</h2>
          <input className="input" placeholder="Search branches..." value={q} onChange={e=>setQ(e.target.value)} style={{marginTop:0, flex:'0 1 260px', maxWidth:260}} />
        </div>
        <p style={{color:'#333', marginBottom:16, fontSize:14, fontFamily:"'Lato', sans-serif"}}>Explore our community branches and discover their upcoming events and resources.</p>

        {filtered.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>{branches.length===0 ? 'No branches yet.' : `No branches match "${q}"`}</div> : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16}}>
            {filtered.map(b=>{
              const isMine = user?.branchId === b.id
              return (
                <div key={b.id} className="wire-card" style={{display:'flex', flexDirection:'column', padding:16, marginBottom:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    <h3 style={{fontSize:15, fontFamily:"'Montserrat', sans-serif", color:'#222', margin:0}}>{b.name}</h3>
                    {b.featured && <span className="badge">Featured</span>}
                    {isMine && <span className="badge">My branch</span>}
                  </div>
                  <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                    <Link to={`/branch/${b.id}`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>View Branch</Link>
                    <Link to={`/branch/${b.id}/posts`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>Posts</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
