import React from 'react'
import api from '../api'
import { useToast } from './Toast'

export default function EditableSections({ sections, setSections }){
  const addSection = () => {
    setSections([...sections, { id: Date.now().toString(), image: '', text: '' }])
  }
  const update = (idx, field, value) => {
    const copy = [...sections]
    copy[idx] = { ...copy[idx], [field]: value }
    setSections(copy)
  }
  const remove = (idx) => {
    setSections(sections.filter((_,i)=>i!==idx))
  }
  const move = (idx, dir) => {
    const n = [...sections]
    const j = idx + dir
    if(j<0 || j>=n.length) return
    const tmp = n[idx]; n[idx]=n[j]; n[j]=tmp
    setSections(n)
  }
  const { toast } = useToast()
  const handleUpload = async (idx, file) => {
    if(!file) return
    const fd = new FormData()
    fd.append('image', file)
    try{
      const res = await api.post('/api/upload', fd, { headers: { 'Content-Type':'multipart/form-data'}})
      update(idx, 'image', res.data.url)
      toast('Image uploaded', 'success')
    }catch(e){
      toast('Upload failed: '+ (e.response?.data?.error || e.message), 'error')
    }
  }

  return (
    <div>
      {sections.map((s, idx)=>(
        <div key={s.id} className="edit-section">
          <div className="section-toolbar">
            <strong>Paragraph {idx+1}</strong>
            <div style={{display:'flex', gap:6}}>
              <button type="button" className="btn btn-small btn-outline" onClick={()=>move(idx,-1)} disabled={idx===0}>↑</button>
              <button type="button" className="btn btn-small btn-outline" onClick={()=>move(idx,1)} disabled={idx===sections.length-1}>↓</button>
              <button type="button" className="btn btn-small btn-danger" onClick={()=>remove(idx)}>Remove</button>
            </div>
          </div>

          <label className="label">Image</label>
          <div className="upload-row">
            <input className="input" placeholder="Image URL or upload" value={s.image} onChange={e=>update(idx,'image', e.target.value)} style={{flex:1}} />
            <label className="btn btn-small btn-outline" style={{whiteSpace:'nowrap', cursor:'pointer'}}>
              Upload
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleUpload(idx, e.target.files[0])} />
            </label>
          </div>
          {s.image && <img src={s.image} alt="preview" className="preview" />}

          <label className="label" style={{marginTop:10, display:'block'}}>Text</label>
          <textarea className="textarea" value={s.text} onChange={e=>update(idx,'text', e.target.value)} placeholder="Write content for this section..." />
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={addSection}>+ Add Paragraph</button>
    </div>
  )
}
