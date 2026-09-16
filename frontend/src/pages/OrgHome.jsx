import React, { useEffect, useState } from 'react'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

export default function OrgHome(){
  const [posts, setPosts] = useState([])
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/api/posts').then(r=> setPosts(r.data)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading...</div>

  const q = applied.trim().toLowerCase()
  const filtered = q ? posts.filter(p=>{
    if(p.title && p.title.toLowerCase().includes(q)) return true
    if(p.sections && p.sections.some(s=> (s.text||'').toLowerCase().includes(q))) return true
    return false
  }) : posts

  const doSearch = ()=> setApplied(query)
  const clear = ()=>{ setQuery(''); setApplied('') }

  return (
    <>
      <div className="container" style={{padding:'20px 20px 32px'}}>
        {/* Wireframe HOME: direct post feed, search is secondary */}
        <div style={{display:'flex', gap:8, marginBottom:14, maxWidth:520, alignItems:'center'}}>
          <input className="input" placeholder="Search posts (title or text)..." value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter' && doSearch()} style={{flex:1, marginTop:0, borderWidth:2, borderColor:'#000'}} />
          <button className="wire-nav-item" onClick={doSearch} style={{cursor:'pointer'}}>Search</button>
          {(query || applied) && <button className="wire-nav-item" onClick={clear} style={{cursor:'pointer'}}>Clear</button>}
        </div>
        {applied && <p style={{fontSize:12, color:'#555', marginBottom:10}}>Showing {filtered.length} result(s) for “{applied}” — every post is shown as post 1 / post 2 boxes per wireframe.</p>}
        {filtered.length===0 ? <div className="wire-card" style={{textAlign:'center', padding:24}}>{posts.length===0 ? 'No posts yet. Branch admins can create posts with date/ages/location/sign-up/extra description.' : `No posts match "${applied}"`}</div> : filtered.map(p=>(
          <WirePostCard key={p.id} post={p} branchName={p.branchName} />
        ))}
      </div>
    </>
  )
}
