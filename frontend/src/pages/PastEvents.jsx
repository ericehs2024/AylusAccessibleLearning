import React, { useEffect, useState } from 'react'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

export default function PastEvents(){
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/api/posts?limit=100').then(r=>setPosts(r.data)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading past events...</div>

  const now = new Date()
  const past = posts.filter(p => new Date(p.date) < now).sort((a,b)=> new Date(b.date) - new Date(a.date))
  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>Past Events</h2>
      <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>Archive of previous accessible learning events and volunteer opportunities.</p>
      {past.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>No past events yet.</div> : past.map(p=>(
        <WirePostCard key={p.id} post={p} branchName={p.branchName} />
      ))}
    </div>
  )
}
