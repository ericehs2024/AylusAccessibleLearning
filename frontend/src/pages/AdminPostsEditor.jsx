import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import EditableSections from '../components/EditableSections'
import SectionView from '../components/SectionView'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

function PostEditor({ branchId, onCreated }){
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState([{ id: Date.now().toString(), image:'', text:'' }])
  const [requiredAges, setRequiredAges] = useState('')
  const [location, setLocation] = useState('')
  const [signUpLink, setSignUpLink] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const create = async ()=>{
    if(!title.trim()) return toast('Title required', 'error')
    setSaving(true)
    try{
      const res = await api.post(`/api/branches/${branchId}/posts`, { title, sections, requiredAges, location, signUpLink, date: date || undefined })
      setTitle(''); setSections([{ id: Date.now().toString(), image:'', text:'' }])
      setRequiredAges(''); setLocation(''); setSignUpLink(''); setDate('')
      toast('Post published', 'success')
      onCreated(res.data)
    }catch(e){ toast(e.response?.data?.error || e.message, 'error')}
    finally{ setSaving(false)}
  }

  return (
    <div className="card">
      <h3 style={{marginBottom:10}}>Create New Post — wireframe fields</h3>
      <p style={{fontSize:13, color:'#5f6368', marginBottom:8}}>Fields match wireframe: date, Age group, location, sign up form — paragraph provides description.</p>
      <label className="label">Post Title (post 1)</label>
      <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Tutoring Volunteers Needed" />
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
        <div>
          <label className="label">date</label>
          <input className="input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Age group</label>
          <input className="input" value={requiredAges} onChange={e=>setRequiredAges(e.target.value)} placeholder="e.g. 14-18 or All ages" />
        </div>
        <div>
          <label className="label">location (zoom, etc)</label>
          <input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Zoom or Library Room 2" />
        </div>
        <div>
          <label className="label">sign up form (URL)</label>
          <input className="input" value={signUpLink} onChange={e=>setSignUpLink(e.target.value)} placeholder="https://forms.gle/..." />
        </div>
      </div>
      <div style={{marginTop:14}}>
        <label className="label">Paragraph (description) — visible after “Click to see more”</label>
        <EditableSections sections={sections} setSections={setSections} />
      </div>
      <button className="btn" style={{marginTop:14}} onClick={create} disabled={saving}>{saving?'Publishing...':'Publish Post'}</button>
    </div>
  )
}

export default function AdminPostsEditor(){
  const { id } = useParams()
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [editing, setEditing] = useState(null) // post being edited
  const [editTitle, setEditTitle] = useState('')
  const [editSections, setEditSections] = useState([])
  const [editRequiredAges, setEditRequiredAges] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSignUpLink, setEditSignUpLink] = useState('')
  const [editDate, setEditDate] = useState('')

  const load = ()=> api.get(`/api/branches/${id}/posts`).then(r=>setPosts(r.data))
  useEffect(()=>{ load() },[id])

  if(!user || user.branchId !== id){
    return <div className="container" style={{padding:40}}><p>You must log in as admin of <strong>{id}</strong> to manage posts.</p><Link to="/login" className="btn">Go to Login</Link></div>
  }

  const startEdit = (p)=>{
    setEditing(p.id)
    setEditTitle(p.title)
    setEditSections(p.sections || [])
    setEditRequiredAges(p.requiredAges || '')
    setEditLocation(p.location || '')
    setEditSignUpLink(p.signUpLink || '')
    setEditDate(p.date ? new Date(p.date).toISOString().slice(0,16) : '')
  }
  const { toast, showConfirm } = useToast()
  const saveEdit = async (postId)=>{
    try{
      await api.put(`/api/branches/${id}/posts/${postId}`, { title: editTitle, sections: editSections, requiredAges: editRequiredAges, location: editLocation, signUpLink: editSignUpLink, date: editDate || undefined })
      setEditing(null)
      toast('Post updated', 'success')
      load()
    }catch(e){ toast(e.response?.data?.error || e.message, 'error')}
  }
  const del = async (postId)=>{
    const ok = await showConfirm('Delete this post? This cannot be undone.')
    if(!ok) return
    try{
      await api.delete(`/api/branches/${id}/posts/${postId}`)
      toast('Post deleted', 'success')
      load()
    }catch(e){ toast(e.response?.data?.error || e.message, 'error') }
  }

  return (
    <div className="container" style={{padding:'28px 20px', maxWidth:860}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>Manage Posts — {id}</h2>
        <div style={{display:'flex', gap:8}}>
          <Link to={`/branch/${id}/posts`} className="btn btn-outline btn-small">View Posts Page</Link>
          <Link to="/" className="btn btn-outline btn-small">Org Home</Link>
        </div>
      </div>

      <PostEditor branchId={id} onCreated={()=>load()} />

      <h3 style={{margin:'24px 0 12px'}}>Existing Posts ({posts.length})</h3>
      {posts.length===0 ? <div className="card">No posts yet. Publish your first opportunity above.</div> :
        posts.map(p=>(
          <div key={p.id} className="card post-card">
            <div className="post-meta">
              <span>{new Date(p.date).toLocaleString()}</span>
              <span style={{fontSize:12, color:'#5f6368'}}>ID: {p.id}</span>
            </div>
            {editing===p.id ? (
              <>
                <label className="label">Title</label>
                <input className="input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
                  <div><label className="label">date</label><input className="input" type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
                  <div><label className="label">Age group</label><input className="input" value={editRequiredAges} onChange={e=>setEditRequiredAges(e.target.value)} /></div>
                  <div><label className="label">location</label><input className="input" value={editLocation} onChange={e=>setEditLocation(e.target.value)} /></div>
                  <div><label className="label">sign up form</label><input className="input" value={editSignUpLink} onChange={e=>setEditSignUpLink(e.target.value)} /></div>
                </div>
                <div style={{marginTop:12}}>
                  <EditableSections sections={editSections} setSections={setEditSections} />
                </div>
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button className="btn btn-small" onClick={()=>saveEdit(p.id)}>Save</button>
                  <button className="btn btn-small btn-outline" onClick={()=>setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{margin:'6px 0 10px'}}>{p.title}</h3>
                <div style={{fontSize:13, color:'#5f6368', lineHeight:1.7, marginBottom:8}}>
                  <div><b>date:</b> {new Date(p.date).toLocaleDateString()} &nbsp; <b>Age group:</b> {p.requiredAges || 'All'} &nbsp; <b>location:</b> {p.location || 'TBD'}</div>
                  <div><b>sign up:</b> {p.signUpLink ? <a href={p.signUpLink} target="_blank" rel="noreferrer">link</a> : '—'}</div>
                </div>
                <SectionView sections={p.sections} />
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button className="btn btn-small btn-outline" onClick={()=>startEdit(p)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={()=>del(p.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))
      }
    </div>
  )
}
