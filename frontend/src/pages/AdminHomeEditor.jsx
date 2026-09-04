import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'
import EditableSections from '../components/EditableSections'
import { useAuth } from '../context/AuthContext'

export default function AdminHomeEditor(){
  const { id } = useParams()
  const { user, token } = useAuth()
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=>{
    if(!user || user.branchId !== id){
      // redirect to login if not owner
    }
    api.get(`/api/branches/${id}`).then(r=>{
      setTitle(r.data.home?.title || '')
      setSections(r.data.home?.sections || [])
    }).finally(()=>setLoading(false))
  },[id])

  if(!user || user.branchId !== id){
    return <div className="container" style={{padding:40}}><p>You must log in as admin of <strong>{id}</strong> to edit.</p><Link to="/login" className="btn">Go to Login</Link></div>
  }
  if(loading) return <div className="container" style={{padding:40}}>Loading...</div>

  const save = async ()=>{
    setSaving(true); setMsg('')
    try{
      await api.put(`/api/branches/${id}/home`, { title, sections })
      setMsg('✅ Home page saved!')
      setTimeout(()=> nav(`/branch/${id}`), 800)
    }catch(e){
      setMsg('❌ '+(e.response?.data?.error || e.message))
    }finally{ setSaving(false)}
  }

  return (
    <div className="container" style={{padding:'28px 20px', maxWidth:820}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>Edit Home — {id}</h2>
        <Link to={`/branch/${id}`} className="btn btn-outline btn-small">Back to Branch</Link>
      </div>
      <div className="card">
        <label className="label">Page Title</label>
        <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Home page title" />
        <div style={{marginTop:18}}>
          <label className="label">Sections (repeatable: image + textarea)</label>
          <p style={{fontSize:13, color:'#5f6368', marginBottom:10}}>Each section has an image uploader/URL and a textarea. Add as many as you need.</p>
          <EditableSections sections={sections} setSections={setSections} />
        </div>
        {msg && <div style={{marginTop:12, padding:10, background: msg.startsWith('✅') ? '#e6f4ea' : '#fce8e6', borderRadius:8, fontSize:14}}>{msg}</div>}
        <button className="btn" style={{marginTop:16}} onClick={save} disabled={saving}>{saving?'Saving...':'Save & Publish Home'}</button>
      </div>
    </div>
  )
}
