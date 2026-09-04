import React, { useEffect, useState } from 'react'
import api from '../api'
import SectionView from '../components/SectionView'

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
      <div className="container" style={{padding:'32px 20px'}}>
        <h2 style={{marginBottom:6}}>Posts from All Branches</h2>
        <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>Every post published by a branch admin automatically appears here.</p>

        <div style={{display:'flex', gap:8, marginBottom:16, maxWidth:520, alignItems:'center'}}>
          <input className="input" placeholder="Search posts by keyword in title or paragraphs..." value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter' && doSearch()} style={{flex:1, marginTop:0}} />
          <button className="btn btn-small" onClick={doSearch}>Search</button>
          {(query || applied) && <button className="btn btn-outline btn-small" onClick={clear}>Clear</button>}
        </div>
        {filtered.length===0 ? <div className="card">{posts.length===0 ? 'No posts yet.' : `No posts match "${applied}"`}</div> : filtered.map(p=>(
          <div key={p.id} className="card post-card">
            <div className="post-meta">
              <span className="badge">{p.branchName}</span>
              <span>{new Date(p.date).toLocaleString()}</span>
            </div>
            <h3 style={{marginBottom:8}}>{p.title}</h3>
            <SectionView sections={p.sections} />
          </div>
        ))}
      </div>
    </>
  )
}
