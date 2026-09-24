import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import PasswordInput from '../components/PasswordInput'

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
  const [mode, setMode] = useState('direct') // 'direct' = oldPassword, 'email' = verification code
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
  // direct change with old password
  const [oldPassword, setOldPassword] = useState('')
  const [directNewPassword, setDirectNewPassword] = useState('')
  const [directConfirm, setDirectConfirm] = useState('')
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

  const handleDirectChange = async (e)=>{
    e.preventDefault()
    setErr(''); setMsg('')
    const v = validatePassword(directNewPassword)
    if(v) return setErr(v)
    if(directNewPassword !== directConfirm) return setErr('Passwords do not match')
    if(!oldPassword) return setErr('Current password required')
    setLoading(true)
    try{
      await api.post('/api/auth/change-password', { oldPassword, newPassword: directNewPassword })
      setMsg('Password changed successfully! Please login again.')
      setOldPassword(''); setDirectNewPassword(''); setDirectConfirm('')
      setTimeout(()=> nav('/'), 1500)
    }catch(ex){ setErr(ex.response?.data?.error || 'Failed to change password') }
    finally{ setLoading(false)}
  }

  const mmss = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`

  return (
    <div className="container" style={{maxWidth:520, padding:'32px 20px'}}>
      <h2>Change Password — {user.username}</h2>
      <p style={{color:'#5f6368', fontSize:13, margin:'6px 0 14px'}}>Choose: change directly with current password, or reset via email verification code (5 min expiry, sent via SMTP).</p>

      <div style={{display:'flex', gap:8, marginBottom:14}}>
        <button onClick={()=>{setMode('direct'); setErr(''); setMsg('')}} className={mode==='direct' ? 'btn btn-small' : 'btn btn-small btn-outline'} aria-pressed={mode==='direct'}>Change with current password</button>
        <button onClick={()=>{setMode('email'); setErr(''); setMsg('')}} className={mode==='email' ? 'btn btn-small' : 'btn btn-small btn-outline'} aria-pressed={mode==='email'}>Reset via Email Code</button>
      </div>

      {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:8, marginBottom:12, fontSize:14}}>{err}</div>}
      {msg && <div style={{background:'#e6f4ea', color:'#137333', padding:10, borderRadius:8, marginBottom:12, fontSize:14}}>{msg}</div>}

      {mode==='direct' && (
        <form onSubmit={handleDirectChange} className="card">
          <label className="label">Current Password</label>
          <PasswordInput value={oldPassword} onChange={e=>setOldPassword(e.target.value)} placeholder="Current password" required />
          <label className="label" style={{marginTop:12, display:'block'}}>New Password</label>
          <PasswordInput value={directNewPassword} onChange={e=>setDirectNewPassword(e.target.value)} placeholder="New password" required />
          <div style={{background:'#fef7e0', border:'1px solid #fbbc04', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, lineHeight:1.5}}>
            <b>Hint:</b> 8+ chars, 2+ digits, 1 uppercase. Example: <code>Sunshine12</code>
            <div style={{marginTop:6}}>
              <span style={{color: directNewPassword.length>=8 ? '#137333':'#5f6368'}}>• {directNewPassword.length} / 8 chars {directNewPassword.length>=8 ? '✓':'✗'}</span><br/>
              <span style={{color: ((directNewPassword.match(/\d/g)||[]).length)>=2 ? '#137333':'#5f6368'}}>• {(directNewPassword.match(/\d/g)||[]).length} / 2 digits {((directNewPassword.match(/\d/g)||[]).length)>=2 ? '✓':'✗'}</span><br/>
              <span style={{color: /[A-Z]/.test(directNewPassword) ? '#137333':'#5f6368'}}>• Uppercase {/[A-Z]/.test(directNewPassword) ? '✓':'✗'}</span>
            </div>
          </div>
          <label className="label" style={{marginTop:12, display:'block'}}>Confirm New Password</label>
          <PasswordInput value={directConfirm} onChange={e=>setDirectConfirm(e.target.value)} placeholder="Re-enter new password" required />
          <button className="btn" style={{marginTop:14, width:'100%'}} disabled={loading}>{loading ? 'Saving...' : 'Change Password'}</button>
          <p style={{fontSize:12, color:'#5f6368', marginTop:8, textAlign:'center'}}>Email not required. Uses current password verification.</p>
        </form>
      )}

      {mode==='email' && (
        <>
          <p style={{color:'#5f6368', fontSize:13, margin:'0 0 10px'}}>Email flow: enter email twice → receive code → verify → set new password</p>
          <div style={{display:'flex', gap:8, marginBottom:14}}>
            <span className="badge" style={{background: step===1 ? '#dd4444' : '#fff5f5', color: step===1 ? 'white' : '#b51c1c', border: step===1 ? 'none' : '1px solid #dd4444'}}>1 Email</span>
            <span className="badge" style={{background: step===2 ? '#dd4444' : '#fff5f5', color: step===2 ? 'white' : '#b51c1c', border: step===2 ? 'none' : '1px solid #dd4444'}}>2 Verify</span>
            <span className="badge" style={{background: step===3 ? '#dd4444' : '#fff5f5', color: step===3 ? 'white' : '#b51c1c', border: step===3 ? 'none' : '1px solid #dd4444'}}>3 New Password</span>
          </div>
        </>
      )}

      {mode==='email' && step===1 && (
        <form onSubmit={requestCode} className="card" style={{display:'block'}}>
          <label className="label" htmlFor="cp-email">Email</label>
          <input id="cp-email" className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@branch.org" required autoComplete="email" aria-label="Email address" />
          <label className="label" htmlFor="cp-confirm-email" style={{marginTop:12, display:'block'}}>Confirm Email</label>
          <input id="cp-confirm-email" className="input" type="email" value={confirmEmail} onChange={e=>setConfirmEmail(e.target.value)} placeholder="re-enter email" required autoComplete="email" aria-label="Confirm email address" />
          <p style={{fontSize:12, color:'#5f6368', marginTop:8}}>Both emails must match. Code will be sent to this address via SMTP ({/smtp/i.test('')?'configured':'dev mode logs to console'}).</p>
          <button type="submit" className="btn" aria-label="Send verification code" style={{marginTop:14, width:'100%', display:'flex', justifyContent:'center', whiteSpace:'nowrap', overflow:'visible', textOverflow:'clip'}} disabled={loading}>{loading ? 'Sending...' : 'Send Verification Code'}</button>
        </form>
      )}

      {mode==='email' && step===2 && (
        <form onSubmit={verifyCode} className="card" style={{display:'block'}}>
          <p style={{fontSize:14, marginBottom:8}}>Code sent to <b>{email}</b> — expires in <b style={{color: remaining<60 ? '#d93025':'#dd4444'}}>{mmss}</b></p>
          <div style={{height:6, background:'#e8eaed', borderRadius:999, overflow:'hidden', marginBottom:12}} role="progressbar" aria-valuenow={remaining} aria-valuemin={0} aria-valuemax={300}>
            <div style={{width: `${(remaining/300)*100}%`, height:'100%', background: remaining<60 ? '#d93025' : '#dd4444', transition:'width 1s linear'}} />
          </div>
          <label className="label" htmlFor="cp-code">Verification Code (6 digits)</label>
          <input id="cp-code" className="input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456" required style={{letterSpacing:4, fontSize:18, textAlign:'center'}} inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" aria-label="6 digit verification code" />
          <p style={{fontSize:12, color:'#5f6368', marginTop:8}}>Screen waits for code entry. After verified you can set new password. Code expires after 5 mins.</p>
          <button type="submit" className="btn" aria-label="Verify code" style={{marginTop:14, width:'100%', display:'flex', justifyContent:'center', whiteSpace:'nowrap'}} disabled={loading || remaining===0}>{loading ? 'Verifying...' : 'Verify Code'}</button>
          <button type="button" className="btn btn-outline" aria-label="Back to email entry" style={{marginTop:8, width:'100%', display:'flex', justifyContent:'center'}} onClick={()=>{setStep(1); setExpiresAt(null)}}>Back / Resend</button>
        </form>
      )}

      {mode==='email' && step===3 && (
        <form onSubmit={resetPassword} className="card" style={{display:'block'}}>
          <label className="label" htmlFor="cp-new-password">New Password</label>
          <PasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" required />
          <div style={{background:'#fef7e0', border:'1px solid #fbbc04', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:12, lineHeight:1.5}}>
            <b>Hint:</b> Minimum 8 characters, at least <b>2 digits</b> and <b>one uppercase letter</b>.<br/>
            Example: <code>Sunshine12</code> ✓ — <code>password</code> ✗ (no digits/uppercase)
            <div style={{marginTop:6}}>
              <span style={{color: newPassword.length>=8 ? '#137333':'#5f6368'}}>• {newPassword.length} / 8 chars {newPassword.length>=8 ? '✓':'✗'}</span><br/>
              <span style={{color: ((newPassword.match(/\d/g)||[]).length)>=2 ? '#137333':'#5f6368'}}>• {(newPassword.match(/\d/g)||[]).length} / 2 digits {((newPassword.match(/\d/g)||[]).length)>=2 ? '✓':'✗'}</span><br/>
              <span style={{color: /[A-Z]/.test(newPassword) ? '#137333':'#5f6368'}}>• Uppercase {/[A-Z]/.test(newPassword) ? '✓':'✗'}</span>
            </div>
          </div>
          <label className="label" style={{marginTop:12, display:'block'}} htmlFor="cp-confirm-password">Confirm New Password</label>
          <PasswordInput value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required />
          <button type="submit" className="btn" aria-label="Save new password" style={{marginTop:14, width:'100%', display:'flex', justifyContent:'center', whiteSpace:'nowrap'}} disabled={loading}>{loading ? 'Saving...' : 'Save New Password'}</button>
        </form>
      )}
    </div>
  )
}
