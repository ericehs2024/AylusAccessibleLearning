import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function Branches(){
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/api/branches').then(r=>setBranches(r.data)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading branches...</div>

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>All Branches</h2>
      <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>All Aylus branches — matching wireframe “All branches” nav. Click View Branch to see home & posts.</p>

      {branches.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>No branches yet.</div> : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16}}>
          {branches.map(b=>(
            <div key={b.id} className="wire-card" style={{display:'flex', flexDirection:'column', padding:16, marginBottom:0}}>
              <h3 style={{fontSize:15, fontFamily:'Arial, Helvetica, sans-serif'}}>{b.name}</h3>
              <p style={{color:'#555', fontSize:12, margin:'6px 0 12px'}}>Branch ID: {b.id} • Admin: {b.username}</p>
              <div style={{display:'flex', gap:8, marginTop:'auto', flexWrap:'wrap'}}>
                <Link to={`/branch/${b.id}`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0}}>View Branch</Link>
                <Link to={`/branch/${b.id}/posts`} className="wire-nav-item" style={{fontSize:12, padding:'6px 12px', minWidth:0}}>Posts</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
