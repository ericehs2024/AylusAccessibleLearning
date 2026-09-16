import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function MyBranch(){
  const { user } = useAuth()
  const nav = useNavigate()
  const [branches, setBranches] = useState([])

  useEffect(()=>{
    if(user && user.branchId){
      nav(`/branch/${user.branchId}`, { replace: true })
    } else {
      api.get('/api/branches').then(r=>setBranches(r.data)).catch(()=>{})
    }
  },[user, nav])

  if(user && user.branchId) return <div className="container" style={{padding:40}}>Redirecting to your branch...</div>

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>My Branch</h2>
      <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>You are not logged in. Log in to manage your branch, or select a branch to view.</p>
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <Link to="/login" className="btn">Admin Login</Link>
        <Link to="/branches" className="btn btn-outline">All Branches</Link>
      </div>
      {branches.length>0 && (
        <>
          <h3 style={{marginBottom:10}}>Quick jump</h3>
          <div className="grid">
            {branches.slice(0,12).map(b=>(
              <div key={b.id} className="wire-card" style={{padding:16}}>
                <strong>{b.name}</strong>
                <div style={{fontSize:12, color:'#777', margin:'4px 0 10px'}}>ID: {b.id}</div>
                <Link to={`/branch/${b.id}`} className="btn btn-small">View Branch</Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
