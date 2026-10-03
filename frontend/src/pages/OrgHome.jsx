import React, { useEffect, useState } from 'react'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

export default function OrgHome(){
  const [posts, setPosts] = useState([])
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [needsVolunteersOnly, setNeedsVolunteersOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/api/posts').then(r=> setPosts(r.data)).catch(e=>console.error('[OrgHome] GET /api/posts failed', e.response?.data || e.message)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading...</div>

  const q = applied.trim().toLowerCase()
  const filtered = posts.filter(p=>{
    if (needsVolunteersOnly && !(p.volunteersNeeded != null && Number(p.volunteersNeeded) > 0)) return false
    if (!q) return true
    if(p.title && p.title.toLowerCase().includes(q)) return true
    if(p.sections && p.sections.some(s=> (s.text||'').toLowerCase().includes(q))) return true
    return false
  })

  const doSearch = ()=> setApplied(query)
  const clear = ()=>{ setQuery(''); setApplied(''); setNeedsVolunteersOnly(false) }

  return (
    <>
      <div className="container" style={{padding:'20px 20px 32px'}}>
        <div className="wire-card" style={{marginBottom:18, padding:'20px 22px', lineHeight:1.65}}>
          <h2 style={{margin:'0 0 10px', fontSize:20}}>Welcome to the AYLUS Accessible Learning Program!</h2>
          <p style={{margin:'0 0 10px'}}>Our Accessible Learning Platform is designed to connect students, volunteers, and instructors across 196 AYLUS branches nationwide.</p>
          <ul style={{margin:'0 0 10px 20px', padding:0}}>
            <li><strong>Instructors:</strong> Post your upcoming educational events and share learning opportunities with students across the country.</li>
            <li><strong>Volunteers:</strong> Explore volunteer opportunities and find projects that match your interests and skills.</li>
            <li><strong>Students:</strong> Discover free educational opportunities in a wide range of subjects, taught by passionate high school volunteer instructors.</li>
          </ul>
          <p style={{margin:0}}>We believe that every student deserves equal access to educational opportunities, regardless of their background. Together, we can make learning more accessible and help students discover new interests, develop valuable skills, and reach their full potential.</p>
        </div>
        {/* Wireframe HOME: direct post feed, search is secondary */}
        <div style={{display:'flex', gap:8, marginBottom:10, maxWidth:520, alignItems:'center'}}>
          <input className="input" placeholder="Search posts (title or text)..." value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter' && doSearch()} style={{flex:1, marginTop:0}} />
          <button className="btn btn-small" onClick={doSearch} style={{cursor:'pointer'}}>Search</button>
          {(query || applied || needsVolunteersOnly) && <button className="btn btn-small btn-outline" onClick={clear} style={{cursor:'pointer'}}>Clear</button>}
        </div>
        <label style={{display:'inline-flex', gap:8, alignItems:'center', fontSize:13, marginBottom:14, cursor:'pointer', userSelect:'none'}}>
          <input type="checkbox" checked={needsVolunteersOnly} onChange={e=>setNeedsVolunteersOnly(e.target.checked)} style={{width:16, height:16, accentColor:'#dd4444'}} />
          Only show events needing volunteers
        </label>
        {(applied || needsVolunteersOnly) && <p style={{fontSize:12, color:'#555', marginBottom:10}}>Showing {filtered.length} result(s){applied ? ` for “${applied}”` : ''}{needsVolunteersOnly ? ' needing volunteers' : ''}.</p>}
        {filtered.length===0 ? <div className="wire-card" style={{textAlign:'center', padding:24}}>{posts.length===0 ? 'No posts yet. Check back soon for new opportunities.' : `No posts match "${applied}"`}</div> : filtered.map(p=>(
          <WirePostCard key={p.id} post={p} branchName={p.branchName} />
        ))}
      </div>
    </>
  )
}
