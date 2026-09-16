import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import SectionView from '../components/SectionView'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

export default function PostDetail(){
  const params = useParams()
  // supports /post/:postId and /branch/:branchId/post/:postId
  const postId = params.postId
  const { user } = useAuth()
  const { toast } = useToast()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(()=>{
    if(!postId) return
    setLoading(true)
    api.get(`/api/posts/${postId}`).then(r=>setPost(r.data)).catch(e=>setErr(e.response?.data?.error||'Not found')).finally(()=>setLoading(false))
    api.get(`/api/posts/${postId}/comments`).then(r=>setComments(r.data)).catch(()=>{})
  },[postId])

  const submitComment = async (e)=>{
    e.preventDefault()
    if(!authorName.trim() || !text.trim()){
      toast('Name and comment required','error')
      return
    }
    setSubmitting(true)
    try{
      const res = await api.post(`/api/posts/${postId}/comments`, { authorName, text })
      setComments(prev=>[...prev, res.data])
      setText('')
      toast('Comment posted','success')
    }catch(ex){
      toast(ex.response?.data?.error||'Failed to post','error')
    }finally{ setSubmitting(false)}
  }

  const deleteComment = async (cid)=>{
    if(!post) return
    try{
      const token = localStorage.getItem('aylus_token')
      await api.delete(`/api/posts/${post.id}/comments/${cid}`, { headers: token ? { Authorization: `Bearer ${token}`} : {} })
      setComments(prev=>prev.filter(c=>c.id!==cid))
      toast('Comment deleted','success')
    }catch(ex){
      toast(ex.response?.data?.error||'Delete failed','error')
    }
  }

  if(loading) return <div className="container" style={{padding:40}}>Loading post...</div>
  if(err) return <div className="container" style={{padding:40}}>{err} <Link to="/" className="wire-nav-item" style={{marginLeft:8}}>HOME</Link></div>
  if(!post) return <div className="container" style={{padding:40}}>Post not found</div>

  const dateOnly = post.date ? new Date(post.date).toLocaleDateString() : 'Date TBD'
  const dateFull = post.date ? new Date(post.date).toLocaleString() : ''
  const isOwner = user && user.branchId === post.branchId

  return (
    <div className="container" style={{padding:'24px 20px', maxWidth:860}}>
      <div style={{marginBottom:12, display:'flex', gap:8, flexWrap:'wrap'}}>
        <Link to="/" className="wire-nav-item" style={{fontSize:12}}>← Back to Home</Link>
        {post.branchId && <Link to={`/branch/${post.branchId}`} className="wire-nav-item" style={{fontSize:12}}>{post.branchName || post.branchId}</Link>}
        {post.branchId && <Link to={`/branch/${post.branchId}/posts`} className="wire-nav-item" style={{fontSize:12}}>Branch posts</Link>}
      </div>

      <article className="wire-card" style={{marginBottom:20}}>
        <h1 className="wire-card-title" style={{fontSize:20, marginBottom:6}}>{post.title}</h1>
        <div className="wire-inline-row" style={{marginBottom:12}}>
          <div className="wire-field"><span className="wire-label">BRANCH</span><span className="wire-meta-branch" style={{marginBottom:0}}>{post.branchName}</span></div>
          <div className="wire-field"><span className="wire-label">DATE</span><span>{dateOnly}</span></div>
          <div className="wire-field"><span className="wire-label">AGE GROUP</span><span>{post.requiredAges || 'All ages'}</span></div>
        </div>
        <div style={{fontSize:11, color:'#666', marginBottom:10}}>{dateFull}</div>
        <div className="wire-field"><span className="wire-label">location (zoom, etc)</span><span>{post.location || 'TBD'}</span></div>
        <div className="wire-field">
          <span className="wire-label">sign up form</span>
          {post.signUpLink ? <a href={post.signUpLink} target="_blank" rel="noreferrer" className="wire-link">Sign up link</a> : <span style={{color:'#666', fontWeight:600}}>No link yet</span>}
        </div>
        <div style={{borderTop:'3px solid #000', marginTop:14, paddingTop:14}}>
          <SectionView sections={post.sections} />
          {post.signUpLink && <p style={{marginTop:12}}><a href={post.signUpLink} target="_blank" rel="noreferrer" className="wire-nav-item">Open Sign Up Form</a></p>}
        </div>
      </article>

      <section className="wire-card" style={{padding:'16px 18px'}}>
        <h3 style={{fontSize:16, marginBottom:4}}>Comments ({comments.length})</h3>
        <p style={{fontSize:12, color:'#666', marginBottom:14}}>Leave a question or feedback for this post.</p>

        <form onSubmit={submitComment} style={{marginBottom:18, display:'grid', gap:10}}>
          <input className="input" placeholder="Your name" value={authorName} onChange={e=>setAuthorName(e.target.value)} maxLength={80} style={{marginTop:0}} />
          <textarea className="textarea" placeholder="Write a comment..." value={text} onChange={e=>setText(e.target.value)} rows={3} maxLength={2000} style={{minHeight:70}} />
          <div style={{display:'flex', gap:8}}>
            <button type="submit" className="wire-nav-item" disabled={submitting} style={{cursor:'pointer'}}>{submitting?'Posting...':'Post Comment'}</button>
          </div>
        </form>

        {comments.length===0 ? <div style={{padding:12, border:'2px dashed #000', textAlign:'center', fontSize:13, color:'#555'}}>No comments yet — be the first.</div> : (
          <div style={{display:'grid', gap:12}}>
            {comments.map(c=>(
              <div key={c.id} style={{border:'2px solid #000', padding:'10px 12px', background:'white'}}>
                <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                  <strong style={{fontSize:13}}>{c.authorName}</strong>
                  <span style={{fontSize:11, color:'#666'}}>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p style={{fontSize:13, whiteSpace:'pre-wrap', marginTop:6, lineHeight:1.5}}>{c.text}</p>
                {isOwner && (
                  <button className="wire-more-btn" onClick={()=>deleteComment(c.id)} style={{marginTop:6, fontSize:11}}>Delete</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
