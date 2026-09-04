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
    <div className="container" style={{padding:'32px 20px'}}>
      <h1 style={{marginBottom:8}}>Branches</h1>
      <p style={{color:'#5f6368', marginBottom:20}}>All Aylus branches. Each branch manages its own home page and posts, which are shared to the Home feed.</p>

      {branches.length===0 ? <div className="card">No branches yet.</div> : (
        <div className="grid">
          {branches.map(b=>(
            <div key={b.id} className="card" style={{display:'flex', flexDirection:'column'}}>
              <h3>{b.name}</h3>
              <p style={{color:'#5f6368', fontSize:13, margin:'6px 0 12px'}}>Branch ID: {b.id} • Admin: {b.username}</p>
              <div style={{display:'flex', gap:8, marginTop:'auto', flexWrap:'wrap'}}>
                <Link to={`/branch/${b.id}`} className="btn btn-small">View Branch</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
