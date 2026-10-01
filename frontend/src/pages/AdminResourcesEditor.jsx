import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { formatDateTime } from '../utils/date'

const CATEGORIES = ['powerpoints','lesson plans','teaching tips','worksheets','videos','other']

// common documents + videos — restrict resource uploads, all files <10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_DOC_EXTS = ['.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.txt','.csv','.rtf','.odt','.ods','.odp','.mp4','.mov','.avi','.webm','.mkv']
const ALLOWED_DOC_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.rtf,.odt,.ods,.odp,.mp4,.mov,.avi,.webm,.mkv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/rtf,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.presentation,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska'
function isAllowedDocFile(file){
  const name = (file.name || '').toLowerCase()
  return ALLOWED_DOC_EXTS.some(ext => name.endsWith(ext))
}

function isImageFile(url, type, name){
  const t = (type || '').toLowerCase()
  if(t.startsWith('image/')) return true
  const s = (url || name || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(s)
}

function ResourceCreator({ branchId, onCreated }){
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('lesson plans')
  const [description, setDescription] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleFile = async (e)=>{
    const f = e.target.files?.[0]
    if(!f) return
    if(!isAllowedDocFile(f)){
      e.target.value = ''
      toast(`Invalid file type. Allowed: ${ALLOWED_DOC_EXTS.join(', ')}`,'error')
      return
    }
    if(f.size > MAX_FILE_SIZE){
      e.target.value = ''
      toast('File too large (max 10MB). Files larger than 10MB, please add as links in the description textbox.','error')
      return
    }
    const fd = new FormData()
    fd.append('file', f)
    setUploading(true)
    try{
      const res = await api.post('/api/upload/resource', fd, { headers: { 'Content-Type': 'multipart/form-data' }})
      setFileUrl(res.data.url)
      setFileName(res.data.fileName || f.name)
      setFileType(res.data.fileType || f.type)
      toast('File uploaded','success')
    }catch(ex){
      toast(ex.response?.data?.error || 'Upload failed','error')
    }finally{ setUploading(false); e.target.value = '' }
  }

  const create = async ()=>{
    if(!title.trim()) return toast('Title required','error')
    setSaving(true)
    try{
      const res = await api.post(`/api/branches/${branchId}/resources`, { title, category, description, fileUrl: fileUrl || undefined, fileName: fileName || undefined, fileType: fileType || undefined })
      toast('Resource published','success')
      setTitle(''); setCategory('lesson plans'); setDescription(''); setFileUrl(''); setFileName(''); setFileType('')
      onCreated(res.data)
    }catch(e){ toast(e.response?.data?.error || e.message,'error')}
    finally{ setSaving(false)}
  }

  return (
    <div className="card">
      <h3 style={{marginBottom:10}}>Add New Resource — share with all branches</h3>
      <p style={{fontSize:13, color:'#5f6368', marginBottom:10}}>Upload a document ({ALLOWED_DOC_EXTS.join(', ')}) and/or type a description. Pick a label so others can filter.</p>
      <label className="label">Title</label>
      <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Intro to Fractions — Lesson Plan" />
      <div style={{marginTop:12}}>
        <label className="label">Label / Category</label>
        <select className="select" value={category} onChange={e=>setCategory(e.target.value)} style={{marginTop:6}}>
          {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{marginTop:12}}>
        <label className="label">Description / typed content</label>
        <textarea className="textarea" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Type lesson details, teaching tips, or instructions. You can include links. Leave empty if file is enough." style={{minHeight:110}} />
      </div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginTop:16, flexWrap:'wrap'}}>
        <div style={{flex:'1 1 260px', minWidth:220}}>
          <label className="label">Attached file {fileName && `— ${fileName}`}</label>
          <div style={{fontSize:11, color:'#6b6b6b', marginTop:2, lineHeight:1.4}}>Max 10MB. Files larger than 10MB, please add as links in the description textbox.</div>
          <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
            <label className="btn btn-small btn-outline" style={{cursor:'pointer', whiteSpace:'nowrap'}}>
              {uploading ? 'Uploading...' : fileUrl ? 'Replace file' : 'Upload file'}
              <input type="file" style={{display:'none'}} onChange={handleFile} accept={ALLOWED_DOC_ACCEPT} />
            </label>
            {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-small btn-outline">View</a>}
            {fileUrl && <button className="btn btn-small btn-danger" onClick={()=>{setFileUrl(''); setFileName(''); setFileType('')}}>Remove</button>}
          </div>
          {fileUrl && (
            isImageFile(fileUrl, fileType, fileName) ? (
              <div style={{marginTop:8}}>
                <a href={fileUrl} target="_blank" rel="noreferrer"><img src={fileUrl} alt={fileName} style={{width:'100%', maxHeight:260, objectFit:'contain', border:'2px solid #000', background:'white'}} /></a>
                <div style={{fontSize:11, color:'#555', marginTop:4, wordBreak:'break-all'}}>{fileName}</div>
              </div>
            ) : (
              <div style={{fontSize:11, color:'#555', marginTop:6, wordBreak:'break-all'}}>{fileName}</div>
            )
          )}
        </div>
        <button className="btn" style={{alignSelf:'flex-end', marginLeft:'auto', marginTop:20}} onClick={create} disabled={saving || uploading}>{saving ? 'Publishing...' : 'Publish Resource'}</button>
      </div>
    </div>
  )
}

export default function AdminResourcesEditor(){
  const { id } = useParams()
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('other')
  const [editDesc, setEditDesc] = useState('')
  const [editFileUrl, setEditFileUrl] = useState('')
  const [editFileName, setEditFileName] = useState('')
  const { toast, showConfirm } = useToast()

  const load = ()=> api.get(`/api/branches/${id}/resources`).then(r=>setResources(r.data)).catch(()=>{})
  useEffect(()=>{ load() },[id])

  if(!user || user.branchId !== id){
    return <div className="container" style={{padding:40}}><p>You must log in as admin of <strong>{id}</strong> to manage resources.</p><Link to="/login" className="btn">Go to Login</Link></div>
  }

  const startEdit = (r)=>{
    setEditing(r.id)
    setEditTitle(r.title)
    setEditCategory(r.category)
    setEditDesc(r.description || '')
    setEditFileUrl(r.fileUrl || '')
    setEditFileName(r.fileName || '')
  }

  const handleEditFile = async (e)=>{
    const f = e.target.files?.[0]
    if(!f) return
    if(!isAllowedDocFile(f)){
      e.target.value = ''
      toast(`Invalid file type. Allowed: ${ALLOWED_DOC_EXTS.join(', ')}`,'error')
      return
    }
    if(f.size > MAX_FILE_SIZE){
      e.target.value = ''
      toast('File too large (max 10MB). Files larger than 10MB, please add as links in the description textbox.','error')
      return
    }
    const fd = new FormData()
    fd.append('file', f)
    try{
      const res = await api.post('/api/upload/resource', fd, { headers: { 'Content-Type':'multipart/form-data'}})
      setEditFileUrl(res.data.url)
      setEditFileName(res.data.fileName || f.name)
      toast('File uploaded','success')
    }catch(ex){ toast(ex.response?.data?.error || 'Upload failed','error')}
    finally{ e.target.value = '' }
  }

  const saveEdit = async (resId)=>{
    try{
      await api.put(`/api/branches/${id}/resources/${resId}`, { title: editTitle, category: editCategory, description: editDesc, fileUrl: editFileUrl, fileName: editFileName })
      setEditing(null)
      toast('Resource updated','success')
      load()
    }catch(e){ toast(e.response?.data?.error || e.message,'error')}
  }
  const del = async (resId)=>{
    const ok = await showConfirm('Delete this resource? Cannot be undone.')
    if(!ok) return
    try{ await api.delete(`/api/branches/${id}/resources/${resId}`); toast('Deleted','success'); load() }catch(e){ toast(e.response?.data?.error || e.message,'error')}
  }

  return (
    <div className="container" style={{padding:'28px 20px', maxWidth:860}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>Manage Resources — {id}</h2>
        <div style={{display:'flex', gap:8}}>
          <Link to="/resources" className="btn btn-outline btn-small">View All Resources</Link>
          <Link to={`/branch/${id}`} className="btn btn-outline btn-small">Branch Home</Link>
        </div>
      </div>

      <ResourceCreator branchId={id} onCreated={()=>load()} />

      <h3 style={{margin:'24px 0 12px'}}>Your Branch Resources ({resources.length})</h3>
      {resources.length===0 ? <div className="card">No resources yet. Upload your first one above.</div> :
        resources.map(r=>(
          <div key={r.id} className="card" style={{borderLeft:'3px solid #000'}}>
            {editing===r.id ? (
              <>
                <label className="label">Title</label>
                <input className="input" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
                  <div>
                    <label className="label">Category</label>
                    <select className="select" value={editCategory} onChange={e=>setEditCategory(e.target.value)} style={{marginTop:6}}>
                      {CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">File</label>
                    <div style={{fontSize:11, color:'#6b6b6b', marginTop:2, lineHeight:1.4}}>Max 10MB. Files larger than 10MB, please add as links in the description.</div>
                    <div style={{display:'flex', gap:6, marginTop:6}}>
                      <label className="btn btn-small btn-outline" style={{cursor:'pointer'}}>Replace <input type="file" style={{display:'none'}} onChange={handleEditFile} accept={ALLOWED_DOC_ACCEPT} /></label>
                      {editFileUrl && <button className="btn btn-small btn-danger" onClick={()=>{setEditFileUrl(''); setEditFileName('')}}>Clear</button>}
                    </div>
                    {editFileUrl && (
                      isImageFile(editFileUrl, '', editFileName) ? (
                        <div style={{marginTop:8}}>
                          <a href={editFileUrl} target="_blank" rel="noreferrer"><img src={editFileUrl} alt={editFileName} style={{width:'100%', maxHeight:200, objectFit:'contain', border:'2px solid #000', background:'white'}} /></a>
                          <div style={{fontSize:11, marginTop:4, wordBreak:'break-all'}}>{editFileName} — preview above</div>
                        </div>
                      ) : (
                        <div style={{fontSize:11, marginTop:6, wordBreak:'break-all'}}>{editFileName} — <a href={editFileUrl} target="_blank" rel="noreferrer">view</a></div>
                      )
                    )}
                  </div>
                </div>
                <label className="label" style={{marginTop:12, display:'block'}}>Description</label>
                <textarea className="textarea" value={editDesc} onChange={e=>setEditDesc(e.target.value)} />
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button className="btn btn-small" onClick={()=>saveEdit(r.id)}>Save</button>
                  <button className="btn btn-small btn-outline" onClick={()=>setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'start'}}>
                  <h3 style={{margin:0, minWidth:0, wordBreak:'break-word'}}>{r.title}</h3>
                  <span className="badge" style={{background:'#000', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, alignSelf:'start', contain:'layout', transform:'translateZ(0)', lineHeight:1, boxSizing:'border-box', minHeight:20}}>{r.category}</span>
                </div>
                <div style={{fontSize:12, color:'#5f6368', margin:'6px 0 8px'}}>{formatDateTime(r.createdAt)} · {r.branchName}</div>
                {r.description && <p style={{fontSize:14, lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:8}}>{r.description}</p>}
                {r.fileUrl && isImageFile(r.fileUrl, r.fileType, r.fileName) ? (
                  <div style={{marginTop:8, marginBottom:8}}>
                    <a href={r.fileUrl} target="_blank" rel="noreferrer"><img src={r.fileUrl} alt={r.fileName || r.title} style={{width:'100%', maxHeight:320, objectFit:'contain', border:'2px solid #000', background:'white', cursor:'zoom-in'}} loading="lazy" /></a>
                    <div style={{marginTop:6, display:'flex', gap:8, flexWrap:'wrap'}}><a href={r.fileUrl} target="_blank" rel="noreferrer" style={{fontSize:12, textDecoration:'underline', fontWeight:700, color:'#000'}}>View full size</a><a href={r.fileUrl} download={r.fileName || ''} style={{fontSize:12, textDecoration:'underline', color:'#000'}}>Download</a></div>
                  </div>
                ) : r.fileUrl ? (
                  <div style={{marginTop:8}}><a href={r.fileUrl} target="_blank" rel="noreferrer" className="wire-nav-item" style={{fontSize:12}}>{r.fileName ? `Download: ${r.fileName}` : 'Download file'}</a></div>
                ) : (
                  <div style={{fontSize:12, color:'#777'}}>No file attached — typed content only</div>
                )}
                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button className="btn btn-small btn-outline" onClick={()=>startEdit(r)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={()=>del(r.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))
      }
    </div>
  )
}
