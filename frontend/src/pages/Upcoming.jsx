import React, { useEffect, useState } from 'react'
import api from '../api'
import WirePostCard from '../components/WirePostCard'

export default function Upcoming(){
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/api/posts?limit=100').then(r=>setPosts(r.data)).finally(()=>setLoading(false))
  },[])

  if(loading) return <div className="container" style={{padding:40}}>Loading upcoming events...</div>

  const now = new Date()
  const upcoming = posts.filter(p => new Date(p.date) >= now).sort((a,b)=> new Date(a.date) - new Date(b.date))
  // if no date-based upcoming (all past), fallback show future-dated or show all as upcoming if date parse fails, else empty
  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>Upcoming Events</h2>
      <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>Events with a future date. Past events are in Past events.</p>
      {upcoming.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>No upcoming events. Check Past events or All branches.</div> : upcoming.map(p=>(
        <WirePostCard key={p.id} post={p} branchName={p.branchName} />
      ))}
    </div>
  )
}
