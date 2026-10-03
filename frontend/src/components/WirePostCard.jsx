import React from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../utils/date'

export default function WirePostCard({ post, branchName }){
  const dateOnly = formatDate(post.date)
  // required URL structure: /branches/:branchId/posts/:postId (e.g. /branches/branch1/posts/1788496563584-81)
  const branchId = post.branchId || (branchName && branchName.toLowerCase().replace(/\s+/g,'')) || 'unknown'
  const postUrl = `/branches/${branchId}/posts/${post.id}`

  return (
    <article className="wire-card" aria-labelledby={`wire-title-${post.id}`}>
      <div className="wire-card-main">
        <div className="wire-card-left" style={{flex:1}}>
          <div className="wire-card-header">
            <h3 id={`wire-title-${post.id}`} className="wire-card-title">
              <Link
                to={postUrl}
                className="wire-card-title-link"
                aria-label={`Open post ${post.title}`}
              >
                {post.title || 'Untitled Post'}
              </Link>
            </h3>
            <Link to={postUrl} className="wire-more-btn wire-more-top" aria-label={`Open post ${post.title}`}>
              Click to see more
            </Link>
          </div>
          {post.volunteersNeeded != null && Number(post.volunteersNeeded) > 0 && (post.volunteerStatus !== 'closed') && (
            <div style={{marginBottom:8}}><span className="badge">🙋 {post.volunteersNeeded} volunteer{Number(post.volunteersNeeded) === 1 ? '' : 's'} needed · Open</span></div>
          )}
          <div className="wire-inline-row">
            {branchName && <div className="wire-field"><span className="wire-label">BRANCH</span><span className="wire-meta-branch" style={{marginBottom:0}} aria-label="branch">{branchName}</span></div>}
            <div className="wire-field"><span className="wire-label">DATE</span><span>{dateOnly}</span></div>
            <div className="wire-field"><span className="wire-label">AGE GROUP</span><span>{post.requiredAges ? post.requiredAges : 'All ages'}</span></div>
            <div className="wire-field"><span className="wire-label">VOLUNTEERS NEEDED</span><span>{post.volunteersNeeded != null ? post.volunteersNeeded : '—'}</span></div>
            <div className="wire-field"><span className="wire-label">VOLUNTEER STATUS</span><span>{post.volunteerStatus === 'closed' ? 'Closed' : post.volunteerStatus === 'open' ? 'Open' : '—'}</span></div>
          </div>
          <div className="wire-field"><span className="wire-label">Location</span><span>{post.location ? post.location : 'TBD'}</span></div>
          <div className="wire-field">
            <span className="wire-label">Sign-up</span>
            {post.signUpLink ? <a href={post.signUpLink} target="_blank" rel="noreferrer" className="wire-link" aria-label={`Sign up for ${post.title}`}>Sign up</a> : <span style={{color:'#666', fontWeight:600}}>No link yet</span>}
          </div>
        </div>
      </div>
    </article>
  )
}
