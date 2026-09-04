import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import SectionView from '../components/SectionView'
import { useAuth } from '../context/AuthContext'

export default function BranchHome(){
  const { id } = useParams()
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [branch, setBranch] = useState(null)
  const [err, setErr] = useState('')

  useEffect(()=>{
    api.get(`/api/branches/${id}`).then(r=>setBranch(r.data)).catch(e=>setErr(e.response?.data?.error || 'Not found'))
  },[id])

  if(err) return <div className="container" style={{padding:40}}>{err}</div>
  if(!branch) return <div className="container" style={{padding:40}}>Loading...</div>

  const isOwner = user && user.branchId === id
  const displayTitle = (branch.home?.title || branch.name || '').replace(/^Welcome to\s+/i, '')

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <h1>{displayTitle}</h1>
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
          <Link to={`/branch/${id}`} className="tab active">Home</Link>
          <Link to={`/branch/${id}/posts`} className="tab">Posts</Link>
        </div>
        {isOwner && <Link to={`/branch/${id}/admin/home`} className="btn btn-small">Edit Home</Link>}
      </div>

      <div className="card">
        <SectionView sections={branch.home?.sections} />
      </div>
    </div>
  )
}
