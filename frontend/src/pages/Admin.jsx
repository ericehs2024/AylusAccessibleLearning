import React, { useState, useEffect } from 'react'
import api from '../api'
import PasswordInput from '../components/PasswordInput'
import { useAdmin } from '../context/AdminContext'

export default function Admin(){
  const { adminToken, adminLogin, adminLogout, isAdminAuthed } = useAdmin()
  const [adminUsername, setAdminUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [listErr, setListErr] = useState('')

  // new branch form
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [branchPassword, setBranchPassword] = useState('')
  const [createErr, setCreateErr] = useState('')
  const [createOk, setCreateOk] = useState('')
  const [creating, setCreating] = useState(false)

  const isAuthed = isAdminAuthed

  const fetchBranches = async () => {
    if(!adminToken) return
    setBranchLoading(true)
    setListErr('')
    try{
      // api.js interceptor will attach correct admin token (aylus_admin_token), never branch token
      const res = await api.get('/api/admin/branches')
      setBranches(res.data)
    }catch(e){
      const msg = e.response?.data?.error || 'Failed to load branches'
      setListErr(msg)
      if(e.response?.status === 401 || e.response?.status === 403){
        // admin token invalid/expired -> force re-login, but do NOT touch branch session
        adminLogout()
      }
    }finally{ setBranchLoading(false)}
  }

  useEffect(()=>{
    if(adminToken) fetchBranches()
  }, [adminToken])

  const handleLogin = async (e)=>{
    e.preventDefault()
    setErr(''); setLoading(true)
    if(!adminUsername.trim() || !password){
      setErr('Username and password required')
      setLoading(false)
      return
    }
    try{
      const res = await api.post('/api/admin/login', { username: adminUsername.trim(), password })
      const t = res.data.token
      adminLogin(t)
      setPassword('')
    }catch(ex){
      setErr(ex.response?.data?.error || 'Invalid credentials')
    }finally{ setLoading(false)}
  }

  const handleLogout = ()=>{
    adminLogout()
    setBranches([])
  }

  const handleCreate = async (e)=>{
    e.preventDefault()
    setCreateErr(''); setCreateOk('')
    if(!name.trim() || !username.trim() || !branchPassword){
      setCreateErr('Name, username and password are required')
      return
    }
    setCreating(true)
    try{
      // interceptor attaches admin token automatically
      const res = await api.post('/api/admin/branches', {
        name: name.trim(),
        username: username.trim(),
        password: branchPassword
      })
      setCreateOk(`Branch "${res.data.name}" created (username: ${res.data.username})`)
      setName(''); setUsername(''); setBranchPassword('')
      fetchBranches()
    }catch(ex){
      setCreateErr(ex.response?.data?.error || 'Failed to create branch')
    }finally{ setCreating(false)}
  }

  // --- Login gate (username + password) ---
  if(!isAuthed){
    return (
      <div className="container" style={{maxWidth:460, padding:'60px 20px'}}>
        <h2 style={{marginBottom:8}}>Admin</h2>
        <p style={{color:'#5f6368', fontSize:13, marginBottom:18}}>Enter admin username and password to access control panel. Distinct from branch logins.</p>
        <form onSubmit={handleLogin} className="card">
          {err && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:4, marginBottom:12, fontSize:14, border:'2px solid #000'}}>{err}</div>}
          <label className="label">Username</label>
          <input className="input" value={adminUsername} onChange={e=>setAdminUsername(e.target.value)} placeholder="admin" autoFocus style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Password</label>
          <PasswordInput value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{borderWidth:3, borderColor:'#000'}} />
          <button className="btn" style={{marginTop:16, width:'100%', justifyContent:'center', border:'3px solid #000'}} disabled={loading}>{loading ? 'Verifying...' : 'Enter'}</button>
        </form>
      </div>
    )
  }

  // --- Admin control panel ---
  return (
    <div className="container" style={{maxWidth:860, padding:'24px 20px 40px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16}}>
        <h2 style={{borderLeft:'4px solid #000', paddingLeft:10}}>Admin Control Panel</h2>
        <button className="btn btn-outline" onClick={handleLogout} style={{borderWidth:3, borderColor:'#000', color:'#000'}}>Log out</button>
      </div>

      <div className="wire-card" style={{marginBottom:20}}>
        <h3 style={{fontFamily:'Arial, Helvetica, sans-serif', fontSize:14, fontWeight:800, marginBottom:6}}>Add New Branch</h3>
        <p style={{fontSize:12, color:'#333', marginBottom:14}}>Create a branch with a display name, login username and password. Branches appear under “All branches”.</p>
        <form onSubmit={handleCreate}>
          {createErr && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, borderRadius:0, marginBottom:12, fontSize:13, border:'3px solid #000'}}>{createErr}</div>}
          {createOk && <div style={{background:'#e6f4ea', color:'#137333', padding:10, borderRadius:0, marginBottom:12, fontSize:13, border:'3px solid #000'}}>{createOk}</div>}
          <label className="label">Branch Name</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Aylus - Great Neck" style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Username (login)</label>
          <input className="input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. greatneck" style={{borderWidth:3, borderColor:'#000'}} />
          <label className="label" style={{marginTop:12, display:'block'}}>Password</label>
          <PasswordInput value={branchPassword} onChange={e=>setBranchPassword(e.target.value)} placeholder="••••••••" style={{borderWidth:3, borderColor:'#000'}} />
          <button className="btn" style={{marginTop:16, border:'3px solid #000'}} disabled={creating}>{creating ? 'Creating...' : 'Add Branch'}</button>
        </form>
      </div>

      <div className="wire-card">
        <h3 style={{fontFamily:'Arial, Helvetica, sans-serif', fontSize:14, fontWeight:800, marginBottom:10}}>Existing Branches ({branches.length})</h3>
        {branchLoading && <div style={{fontSize:13, color:'#555'}}>Loading branches...</div>}
        {listErr && <div style={{background:'#fce8e6', color:'#b3261e', padding:10, fontSize:13, border:'3px solid #000', marginBottom:10}}>{listErr}</div>}
        {!branchLoading && !listErr && branches.length === 0 && <div style={{fontSize:13, color:'#555'}}>No branches yet.</div>}
        {!branchLoading && branches.length > 0 && (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{textAlign:'left', borderBottom:'3px solid #000'}}>
                  <th style={{padding:'8px 6px'}}>Branch Name</th>
                  <th style={{padding:'8px 6px'}}>Username</th>
                  <th style={{padding:'8px 6px'}}>Email</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b=> (
                  <tr key={b.id} style={{borderBottom:'1px solid #000'}}>
                    <td style={{padding:'8px 6px', fontWeight:700}}>{b.name}</td>
                    <td style={{padding:'8px 6px'}}>{b.username}</td>
                    <td style={{padding:'8px 6px'}}>{b.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
