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
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const create = async ()=>{
    if(!title.trim()) return toast('Title required', 'error')
    setSaving(true)
    try{
      const res = await api.post(`/api/branches/${branchId}/posts`, { title, sections })
      setTitle(''); setSections([{ id: Date.now().toString(), image:'', text:'' }])
      toast('Post published', 'success')
      onCreated(res.data)
    }catch(e){ toast(e.response?.data?.error || e.message, 'error')}
    finally{ setSaving(false)}
  }

  return (
    <div className="card">
      <h3 style={{marginBottom:10}}>Create New Post</h3>
      <p style={{fontSize:13, color:'#5f6368', marginBottom:8}}>Post date is added automatically. Each post is clearly separated on display.</p>
      <label className="label">Post Title</label>
      <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Tutoring Volunteers Needed" />
      <div style={{marginTop:14}}>
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

  const load = ()=> api.get(`/api/branches/${id}/posts`).then(r=>setPosts(r.data))
  useEffect(()=>{ load() },[id])

  if(!user || user.branchId !== id){
    return <div className="container" style={{padding:40}}><p>You must log in as admin of <strong>{id}</strong> to manage posts.</p><Link to="/login" className="btn">Go to Login</Link></div>
  }

  const startEdit = (p)=>{
    setEditing(p.id)
    setEditTitle(p.title)
    setEditSections(p.sections)
  }
  const { toast, showConfirm } = useToast()
  const saveEdit = async (postId)=>{
    try{
      await api.put(`/api/branches/${id}/posts/${postId}`, { title: editTitle, sections: editSections })
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
