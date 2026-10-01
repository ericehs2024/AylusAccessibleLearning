import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import EditableSections from '../components/EditableSections'
import SectionView from '../components/SectionView'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/AdminContext'
import { useToast } from '../components/Toast'
import { formatDate, formatDateTime, toLocalDateTimeInputValue, fromLocalDateTimeInputValue } from '../utils/date'

function PostEditor({ branchId, onCreated }){
  const { isAdminAuthed, adminToken } = useAdmin()
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState([{ id: Date.now().toString(), image:'', text:'' }])
  const [requiredAges, setRequiredAges] = useState('')
  const [location, setLocation] = useState('')
  const [signUpLink, setSignUpLink] = useState('')
  const [volunteersNeeded, setVolunteersNeeded] = useState('')
  const [volunteerStatus, setVolunteerStatus] = useState('') // '' = blank default, 'open', 'closed'
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Auto-rule: entering a headcount > 0 flips a blank status to Open
  const onVolunteersNeededChange = (v)=>{
    setVolunteersNeeded(v)
    if (v !== '' && Number(v) > 0 && !volunteerStatus) setVolunteerStatus('open')
  }

  const create = async ()=>{
    if(!title.trim()) return toast('Title required', 'error')
    setSaving(true)
    try{
      const headers = isAdminAuthed && adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
      const res = await api.post(`/api/branches/${branchId}/posts`, { title, sections, requiredAges, location, signUpLink, volunteersNeeded: volunteersNeeded === '' ? null : Number(volunteersNeeded), volunteerStatus: volunteerStatus || null, date: fromLocalDateTimeInputValue(date) }, { headers })
      setTitle(''); setSections([{ id: Date.now().toString(), image:'', text:'' }])
      setRequiredAges(''); setLocation(''); setSignUpLink(''); setVolunteersNeeded(''); setVolunteerStatus(''); setDate('')
      toast('Post published', 'success')
      onCreated(res.data)
    }catch(e){ toast(e.response?.data?.error || e.message, 'error')}
    finally{ setSaving(false)}
  }

  return (
    <div className="card">
      <h3 style={{marginBottom:10}}>Create New Post</h3>
      <p style={{fontSize:13, color:'#5f6368', marginBottom:8}}>Share an upcoming opportunity with your community.</p>
      <label className="label">Title</label>
      <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Tutoring Volunteers Needed" />
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
        <div>
          <label className="label">Date & time</label>
          <input className="input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Age group</label>
          <input className="input" value={requiredAges} onChange={e=>setRequiredAges(e.target.value)} placeholder="e.g. 14-18 or All ages" />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Zoom or Library Room 2" />
        </div>
        <div>
          <label className="label">Sign-up link</label>
          <input className="input" value={signUpLink} onChange={e=>setSignUpLink(e.target.value)} placeholder="https://forms.gle/..." />
        </div>
        <div>
          <label className="label">Volunteers needed</label>
          <input className="input" type="number" min="0" step="1" value={volunteersNeeded} onChange={e=>onVolunteersNeededChange(e.target.value)} placeholder="e.g. 10 (leave blank if none)" />
        </div>
        <div>
          <label className="label">Volunteer opportunity status</label>
          <select className="select" value={volunteerStatus} onChange={e=>setVolunteerStatus(e.target.value)}>
            <option value="">— (blank)</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div style={{marginTop:14}}>
        <label className="label">Description</label>
        <EditableSections sections={sections} setSections={setSections} />
      </div>
      <button className="btn" style={{marginTop:14}} onClick={create} disabled={saving}>{saving?'Publishing...':'Publish Post'}</button>
    </div>
  )
}

export default function AdminPostsEditor(){
  const { id } = useParams()
  const { user } = useAuth()
  const { isAdminAuthed, adminToken } = useAdmin()
  const [posts, setPosts] = useState([])
  const [editing, setEditing] = useState(null) // post being edited
  const [editTitle, setEditTitle] = useState('')
  const [editSections, setEditSections] = useState([])
  const [editRequiredAges, setEditRequiredAges] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSignUpLink, setEditSignUpLink] = useState('')
  const [editVolunteersNeeded, setEditVolunteersNeeded] = useState('')
  const [editVolunteerStatus, setEditVolunteerStatus] = useState('')
  const [editDate, setEditDate] = useState('')

  const load = ()=> api.get(`/api/branches/${id}/posts`).then(r=>setPosts(r.data))
  useEffect(()=>{ load() },[id])

  const isBranchOwner = user && user.branchId === id
  const isSuperAdmin = isAdminAuthed
  const canManage = isBranchOwner || isSuperAdmin

  if(!canManage){
    return <div className="container" style={{padding:40}}><p>You must log in as admin of <strong>{id}</strong> or as super-admin to manage posts.</p><div style={{display:'flex', gap:10, marginTop:12}}><Link to="/login" className="btn">Branch Login</Link><Link to="/admin" className="btn btn-outline">Super-admin Login</Link></div></div>
  }

  const startEdit = (p)=>{
    setEditing(p.id)
    setEditTitle(p.title)
    setEditSections(p.sections || [])
    setEditRequiredAges(p.requiredAges || '')
    setEditLocation(p.location || '')
    setEditSignUpLink(p.signUpLink || '')
    setEditVolunteersNeeded(p.volunteersNeeded != null ? String(p.volunteersNeeded) : '')
    setEditVolunteerStatus(p.volunteerStatus || '')
    setEditDate(toLocalDateTimeInputValue(p.date))
  }
  // Auto-rule (edit form): entering a headcount > 0 flips a blank status to Open
  const onEditVolunteersNeededChange = (v)=>{
    setEditVolunteersNeeded(v)
    if (v !== '' && Number(v) > 0 && !editVolunteerStatus) setEditVolunteerStatus('open')
  }
  const { toast, showConfirm } = useToast()
  const getAuthHeaders = ()=> isSuperAdmin && adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
  const saveEdit = async (postId)=>{
    try{
      await api.put(`/api/branches/${id}/posts/${postId}`, { title: editTitle, sections: editSections, requiredAges: editRequiredAges, location: editLocation, signUpLink: editSignUpLink, volunteersNeeded: editVolunteersNeeded === '' ? null : Number(editVolunteersNeeded), volunteerStatus: editVolunteerStatus || null, date: fromLocalDateTimeInputValue(editDate) }, { headers: getAuthHeaders() })
      setEditing(null)
      toast('Post updated', 'success')
      load()
    }catch(e){ toast(e.response?.data?.error || e.message, 'error')}
  }
  const del = async (postId)=>{
    const ok = await showConfirm('Delete this post? This cannot be undone.')
    if(!ok) return
    try{
      // super-admin can delete via branch route (admin token) or via global admin route
      if(isSuperAdmin && adminToken){
        try{
          await api.delete(`/api/branches/${id}/posts/${postId}`, { headers: getAuthHeaders() })
        } catch(e){
          // fallback to global admin delete (works even if branch route fails)
          if(e.response?.status === 403 || e.response?.status === 401){
            await api.delete(`/api/admin/posts/${postId}`, { headers: getAuthHeaders() })
          } else throw e
        }
      } else {
        await api.delete(`/api/branches/${id}/posts/${postId}`)
      }
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
              <span>{formatDateTime(p.date)}</span>
            </div>
            {editing===p.id ? (
              <>
                <label className="label">Title</label>
                <input className="input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
                  <div><label className="label">Date & time</label><input className="input" type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} /></div>
                  <div><label className="label">Age group</label><input className="input" value={editRequiredAges} onChange={e=>setEditRequiredAges(e.target.value)} /></div>
                  <div><label className="label">Location</label><input className="input" value={editLocation} onChange={e=>setEditLocation(e.target.value)} /></div>
                  <div><label className="label">Sign-up link</label><input className="input" value={editSignUpLink} onChange={e=>setEditSignUpLink(e.target.value)} /></div>
                  <div><label className="label">Volunteers needed</label><input className="input" type="number" min="0" step="1" value={editVolunteersNeeded} onChange={e=>onEditVolunteersNeededChange(e.target.value)} placeholder="Blank = none" /></div>
                  <div><label className="label">Volunteer opportunity status</label><select className="select" value={editVolunteerStatus} onChange={e=>setEditVolunteerStatus(e.target.value)}><option value="">— (blank)</option><option value="open">Open</option><option value="closed">Closed</option></select></div>
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
                  <div>{formatDate(p.date)} {p.requiredAges ? `· ${p.requiredAges}` : ''} {p.location ? `· ${p.location}` : ''}{p.volunteersNeeded != null ? ` · ${p.volunteersNeeded} volunteer${Number(p.volunteersNeeded) === 1 ? '' : 's'} needed` : ''}{p.volunteerStatus ? ` · ${p.volunteerStatus === 'closed' ? 'Closed' : 'Open'}` : ''}</div>
                  {p.signUpLink && <div><a href={p.signUpLink} target="_blank" rel="noreferrer">Sign-up link</a></div>}
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
