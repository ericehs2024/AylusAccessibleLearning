import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import WirePostCard from '../components/WirePostCard'
import { useAuth } from '../context/AuthContext'

export default function BranchPosts(){
  const { id } = useParams()
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [posts, setPosts] = useState([])
  const [branch, setBranch] = useState(null)

  useEffect(()=>{
    api.get(`/api/branches/${id}`).then(r=>setBranch(r.data)).catch(()=>{})
    api.get(`/api/branches/${id}/posts`).then(r=>setPosts(r.data))
  },[id])

  const isOwner = user && user.branchId === id
  const displayTitle = (branch?.home?.title || branch?.name || id).replace(/^Welcome to\s+/i, '')

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <h1>{displayTitle} — Posts</h1>
        {!isOwner && <Link to={`/login?branch=${id}`} className="btn btn-small">Admin Login</Link>}
      </div>

      {isOwner && (
        <div className="admin-bar">
          <span className="badge">Admin: {user.username}</span>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <Link to="/change-password" className="btn btn-small btn-outline">Change Password</Link>
            <button className="btn btn-small btn-outline" onClick={()=>{logout(); nav(`/branch/${id}`)}}>Logout</button>
          </div>
        </div>
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, margin:'18px 0'}}>
        <div className="tabs" style={{margin:0}}>
          <Link to={`/branch/${id}`} className="tab">Home</Link>
          <Link to={`/branch/${id}/posts`} className="tab active">Posts</Link>
        </div>
        {isOwner && <Link to={`/branch/${id}/admin/posts`} className="btn btn-small">Manage Posts</Link>}
      </div>

      {posts.length===0 ? <div className="wire-card" style={{padding:24, textAlign:'center'}}>No posts yet for this branch.</div> : posts.map(p=>(
        <WirePostCard key={p.id} post={p} branchName={branch?.name || p.branchId} />
      ))}
    </div>
  )
}
