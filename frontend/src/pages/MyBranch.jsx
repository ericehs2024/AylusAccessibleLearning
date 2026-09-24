import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MyBranch(){
  const { user } = useAuth()
  const nav = useNavigate()

  useEffect(()=>{
    if(user && user.branchId){
      nav(`/branch/${user.branchId}`, { replace: true })
    }
  },[user, nav])

  if(user && user.branchId) return <div className="container" style={{padding:40}}>Redirecting to your branch...</div>

  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>My Branch</h2>
      <p style={{color:'#5f6368', marginBottom:16, fontSize:14}}>You are not logged in. Log in to manage your branch.</p>
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <Link to="/login" className="btn">Admin Login</Link>
      </div>
    </div>
  )
}
