import React from 'react'
import { Link } from 'react-router-dom'

export default function Resources(){
  return (
    <div className="container" style={{padding:'28px 20px'}}>
      <h2 style={{marginBottom:6}}>Resources</h2>
      <p style={{color:'#5f6368', marginBottom:20, fontSize:14}}>Accessible learning materials and helpful links for volunteers and students.</p>

      <div className="wire-card" style={{padding:20}}>
        <h3 style={{marginBottom:10}}>Tutoring & Accessibility Guides</h3>
        <ul style={{lineHeight:1.9, paddingLeft:18}}>
          <li><a href="https://www.w3.org/WAI/" target="_blank" rel="noreferrer">W3C Web Accessibility Initiative (WAI)</a> — accessibility fundamentals</li>
          <li><a href="https://www.khanacademy.org" target="_blank" rel="noreferrer">Khan Academy</a> — free lessons for tutors to share</li>
          <li><a href="https://aylus.org" target="_blank" rel="noreferrer">AYLUS.org</a> — main organization site</li>
        </ul>
      </div>

      <div className="wire-card" style={{padding:20}}>
        <h3 style={{marginBottom:10}}>For Branch Admins</h3>
        <p style={{color:'#444', fontSize:14, marginBottom:12}}>Create posts with date, required ages, location (Zoom/in-person), sign-up form link, and extra description. Posts automatically appear on Home, Upcoming, and Past events based on date.</p>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Link to="/login" className="btn btn-small">Admin Login</Link>
          <Link to="/branches" className="btn btn-outline btn-small">All Branches</Link>
        </div>
      </div>

      <div className="wire-card" style={{padding:20}}>
        <h3 style={{marginBottom:10}}>Contact & Support</h3>
        <p style={{color:'#444', fontSize:14}}>Need accessible format or help signing up? Contact your branch via its My branch page or email the national team via <a href="https://aylus.org/contact/" target="_blank" rel="noreferrer">aylus.org/contact</a>.</p>
      </div>
    </div>
  )
}
