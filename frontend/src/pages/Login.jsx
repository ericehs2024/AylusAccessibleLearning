import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Login(){
  const [search] = useSearchParams()
  const branchParam = search.get('branch') || ''
  const [username, setUsername] = useState(branchParam || 'branch1')
  const [password, setPassword] = useState('branch1')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { login } = useAuth()
  const locked = !!branchParam

  useEffect(()=>{
    if(branchParam) setUsername(branchParam)
  }, [branchParam])

  const submit = async (e)=>{
    e.preventDefault()
    setErr(''); setLoading(true)
    try{
      const res = await api.post('/api/auth/login', { username, password })
      login(res.data.token, { ...res.data.branch, branchId: res.data.branch.id })
      nav(`/branch/${res.data.branch.id}`)
    }catch(ex){
      setErr(ex.response?.data?.error || 'Login failed')
    }finally{ setLoading(false)}
  }

  return (
    <div className="container" style={{maxWidth:460, padding:'40px 20px'}}>
      <h2>Branch Admin Login {locked && `— ${branchParam}`}</h2>
      <p style={{color:'#5f6368', fontSize:14, margin:'6px 0 18px'}}>
        {locked ? <>Logging in as <b>{branchParam}</b> (username locked)</> : <>Default: <code>branch1 / branch1</code> and <code>branch2 / branch2</code></>}
      </p>
      <form onSubmit={submit} className="card">
        {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:8, marginBottom:12, fontSize:14}}>{err}</div>}
        <label className="label">Username {locked && '(branch name, read only)'}</label>
        <input className="input" value={username} onChange={e=>!locked && setUsername(e.target.value)} placeholder="branch1" readOnly={locked} style={locked ? {background:'#f1f3f4', cursor:'not-allowed'} : {}} />
        <label className="label" style={{marginTop:12, display:'block'}}>Password</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" />
        <button className="btn" style={{marginTop:16, width:'100%'}} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </div>
  )
}
