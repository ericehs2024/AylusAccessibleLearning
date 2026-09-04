import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'At least 8 characters'
  const digits = (pw.match(/\d/g) || []).length
  if (digits < 2) return 'At least 2 digits required'
  if (!/[A-Z]/.test(pw)) return 'At least one uppercase letter required'
  return null
}

export default function ChangePassword(){
  const { user, token } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(1) // 1 email, 2 code, 3 new password
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(()=>{
    if(!expiresAt) return
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - new Date())/1000))
      setRemaining(diff)
      if(diff===0) clearInterval(timerRef.current)
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return ()=> clearInterval(timerRef.current)
  }, [expiresAt])

  if(!user || !token){
    return <div className="container" style={{padding:40}}><p>You must be logged in as branch admin.</p><Link to="/login" className="btn">Go to Login</Link></div>
  }

  const requestCode = async (e)=>{
    e.preventDefault()
    setErr(''); setMsg('')
    if(email !== confirmEmail) return setErr('Emails do not match')
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Invalid email format')
    setLoading(true)
    try{
      const res = await api.post('/api/auth/request-password-reset', { email, confirmEmail })
      setExpiresAt(res.data.expiresAt)
      setMsg(res.data.devMode ? `Code sent (dev mode code: ${res.data.devCode}) — expires in 5 min` : 'Verification code sent to email (expires in 5 min)')
      setStep(2)
    }catch(ex){ setErr(ex.response?.data?.error || 'Failed to send code') }
    finally{ setLoading(false)}
  }

  const verifyCode = async (e)=>{
    e.preventDefault()
    setErr(''); setMsg('')
    setLoading(true)
    try{
      await api.post('/api/auth/verify-reset-code', { code })
      setMsg('Code verified ✓ Now set your new password')
      setStep(3)
    }catch(ex){ setErr(ex.response?.data?.error || 'Invalid or expired code') }
    finally{ setLoading(false)}
  }

  const resetPassword = async (e)=>{
    e.preventDefault()
    setErr(''); setMsg('')
    const v = validatePassword(newPassword)
    if(v) return setErr(v)
    if(newPassword !== confirmPassword) return setErr('Passwords do not match')
    setLoading(true)
    try{
      await api.post('/api/auth/reset-password', { code, newPassword })
      setMsg('Password updated successfully! Please login again with new password.')
      setTimeout(()=> nav('/'), 1800)
    }catch(ex){ setErr(ex.response?.data?.error || 'Failed to update password') }
    finally{ setLoading(false)}
  }

  const mmss = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`

  return (
    <div className="container" style={{maxWidth:520, padding:'32px 20px'}}>
      <h2>Change Password — {user.username}</h2>
      <p style={{color:'#5f6368', fontSize:13, margin:'6px 0 14px'}}>Steps: enter email twice → receive code (5 min expiry) → verify → set new password</p>

      <div style={{display:'flex', gap:8, marginBottom:14}}>
        <span className="badge" style={{background: step===1 ? '#1a73e8' : '#e8f0fe', color: step===1 ? 'white' : '#1a73e8'}}>1 Email</span>
        <span className="badge" style={{background: step===2 ? '#1a73e8' : '#e8f0fe', color: step===2 ? 'white' : '#1a73e8'}}>2 Verify</span>
        <span className="badge" style={{background: step===3 ? '#1a73e8' : '#e8f0fe', color: step===3 ? 'white' : '#1a73e8'}}>3 New Password</span>
      </div>

      {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:8, marginBottom:12, fontSize:14}}>{err}</div>}
      {msg && <div style={{background:'#e6f4ea', color:'#137333', padding:10, borderRadius:8, marginBottom:12, fontSize:14}}>{msg}</div>}

      {step===1 && (
        <form onSubmit={requestCode} className="card">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@branch.org" required />
          <label className="label" style={{marginTop:12, display:'block'}}>Confirm Email</label>
          <input className="input" type="email" value={confirmEmail} onChange={e=>setConfirmEmail(e.target.value)} placeholder="re-enter email" required />
          <p style={{fontSize:12, color:'#5f6368', marginTop:8}}>Both emails must match. Code will be sent to this address.</p>
          <button className="btn" style={{marginTop:14, width:'100%'}} disabled={loading}>{loading ? 'Sending...' : 'Send Verification Code'}</button>
        </form>
      )}

      {step===2 && (
        <form onSubmit={verifyCode} className="card">
          <p style={{fontSize:14, marginBottom:8}}>Code sent to <b>{email}</b> — expires in <b style={{color: remaining<60 ? '#d93025':'#1a73e8'}}>{mmss}</b></p>
          <div style={{height:6, background:'#e8eaed', borderRadius:999, overflow:'hidden', marginBottom:12}}>
            <div style={{width: `${(remaining/300)*100}%`, height:'100%', background: remaining<60 ? '#d93025' : '#1a73e8', transition:'width 1s linear'}} />
          </div>
          <label className="label">Verification Code (6 digits)</label>
          <input className="input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" required style={{letterSpacing:4, fontSize:18, textAlign:'center'}} />
          <p style={{fontSize:12, color:'#5f6368', marginTop:8}}>Screen waits for code entry. After verified you can set new password. Code expires after 5 mins.</p>
          <button className="btn" style={{marginTop:14, width:'100%'}} disabled={loading || remaining===0}>{loading ? 'Verifying...' : 'Verify Code'}</button>
          <button type="button" className="btn btn-outline" style={{marginTop:8, width:'100%'}} onClick={()=>{setStep(1); setExpiresAt(null)}}>Back / Resend</button>
        </form>
      )}

      {step===3 && (
        <form onSubmit={resetPassword} className="card">
          <label className="label">New Password</label>
          <input className="input" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" required />
          <div style={{background:'#fef7e0', border:'1px solid #fbbc04', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, lineHeight:1.5}}>
            <b>Hint:</b> Minimum 8 characters, at least <b>2 digits</b> and <b>one uppercase letter</b>.<br/>
            Example: <code>Sunshine12</code> ✓ — <code>password</code> ✗ (no digits/uppercase)
            <div style={{marginTop:6}}>
              <span style={{color: newPassword.length>=8 ? '#137333':'#5f6368'}}>• {newPassword.length} / 8 chars {newPassword.length>=8 ? '✓':'✗'}</span><br/>
              <span style={{color: ((newPassword.match(/\d/g)||[]).length)>=2 ? '#137333':'#5f6368'}}>• {(newPassword.match(/\d/g)||[]).length} / 2 digits {((newPassword.match(/\d/g)||[]).length)>=2 ? '✓':'✗'}</span><br/>
              <span style={{color: /[A-Z]/.test(newPassword) ? '#137333':'#5f6368'}}>• Uppercase {/[A-Z]/.test(newPassword) ? '✓':'✗'}</span>
            </div>
          </div>
          <label className="label" style={{marginTop:12, display:'block'}}>Confirm New Password</label>
          <input className="input" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required />
          <button className="btn" style={{marginTop:14, width:'100%'}} disabled={loading}>{loading ? 'Saving...' : 'Save New Password'}</button>
        </form>
      )}
    </div>
  )
}
