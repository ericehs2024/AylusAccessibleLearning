import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Branches(){
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(()=>{
    api.get('/api/branches').then(r=>setBranches(r.data)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading branches...</div>

  const filtered = q.trim() ? branches.filter(b=> b.name.toLowerCase().includes(q.trim().toLowerCase())) : branches

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:6}}>
        <h2 style={{margin:0, fontFamily:"'Montserrat', sans-serif"}}>All Branches</h2>
        <input className="input" placeholder="Search branches..." value={q} onChange={e=>setQ(e.target.value)} style={{marginTop:0, flex:'0 1 260px', maxWidth:260}} />
      </div>
      <p style={{color:'#333', marginBottom:16, fontSize:14, fontFamily:"'Lato', sans-serif"}}>Explore our community branches and discover their upcoming events and resources.</p>

      {filtered.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>{branches.length===0 ? 'No branches yet.' : `No branches match "${q}"`}</div> : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16}}>
          {filtered.map(b=>(
            <div key={b.id} className="wire-card" style={{display:'flex', flexDirection:'column', padding:16, marginBottom:0}}>
              <h3 style={{fontSize:15, fontFamily:"'Montserrat', sans-serif", color:'#222'}}>{b.name}</h3>
              <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                <Link to={`/branch/${b.id}`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>View Branch</Link>
                <Link to={`/branch/${b.id}/posts`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0, fontFamily:"'Mont','Montserrat',sans-serif"}}>Posts</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
