import React from 'react'
import { Link } from 'react-router-dom'

export default function WirePostCard({ post, branchName }){
  const dateOnly = post.date ? new Date(post.date).toLocaleDateString() : 'Date TBD'
  // required URL structure: /branches/:branchId/posts/:postId (e.g. /branches/branch1/posts/1788496563584-81)
  const branchId = post.branchId || (branchName && branchName.toLowerCase().replace(/\s+/g,'')) || 'unknown'
  const postUrl = `/branches/${branchId}/posts/${post.id}`

  return (
    <article className="wire-card" aria-labelledby={`wire-title-${post.id}`}>
      <div className="wire-card-main">
        <div className="wire-card-left" style={{flex:1}}>
          <h3 id={`wire-title-${post.id}`} className="wire-card-title">{post.title || 'Untitled Post'}</h3>
          <div className="wire-inline-row">
            {branchName && <div className="wire-field"><span className="wire-label">BRANCH</span><span className="wire-meta-branch" style={{marginBottom:0}} aria-label="branch">{branchName}</span></div>}
            <div className="wire-field"><span className="wire-label">DATE</span><span>{dateOnly}</span></div>
            <div className="wire-field"><span className="wire-label">AGE GROUP</span><span>{post.requiredAges ? post.requiredAges : 'All ages'}</span></div>
          </div>
          <div className="wire-field"><span className="wire-label">location (zoom, etc)</span><span>{post.location ? post.location : 'TBD'}</span></div>
          <div className="wire-field">
            <span className="wire-label">sign up form</span>
            {post.signUpLink ? <a href={post.signUpLink} target="_blank" rel="noreferrer" className="wire-link" aria-label={`Sign up form for ${post.title}`}>Sign up link</a> : <span style={{color:'#666', fontWeight:600}}>No link yet</span>}
          </div>
        </div>
      </div>

      <div className="wire-card-footer">
        <Link to={postUrl} className="wire-more-btn" aria-label={`Open post ${post.title}`}>
          Click to see more
        </Link>
      </div>
    </article>
  )
}
