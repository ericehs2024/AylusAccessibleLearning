import React from 'react'
import { Link } from 'react-router-dom'

const tabs = [
  { name: 'Home', to: '/', desc: 'Our mission front and center, plus a searchable feed of learning opportunities from every branch.' },
  { name: 'Events', to: '/events', desc: 'Upcoming and completed events in one place with tabs and search, so students always know what\u2019s open now and what already happened.' },
  { name: 'Branches', to: '/branches', desc: 'Every branch gets its own page, with your branch pinned at the top when you log in, plus a Featured Branches spotlight celebrating high-impact chapters.' },
  { name: 'Volunteers', to: '/volunteers', desc: 'Open volunteer opportunities in one place. Any event with Volunteers needed > 0 flips to Open automatically — close it when the spots are filled.' },
  { name: 'Resources', to: '/resources', desc: 'A shared library of lesson plans, worksheets, teaching tips, and videos. Log in with your branch account to view and download the full collection.' },
  { name: 'Hour Compiler', to: '/platform', desc: 'Paste your branch\u2019s aylus.org link, pick a date range, and get a clean per-volunteer hours summary you can expand for details or download as CSV. Great for service-hour reporting!' },
  { name: 'Comments', to: '/events', desc: 'Students and families can ask questions right on your event posts.' },
]

const steps = [
  { title: 'Log in', body: <>Click <Link to="/branches" className="wire-link">Branches</Link>, then <Link to="/login" className="wire-link">Admin Login</Link>, and sign in with your branch username and password. Please check your branch email for your default username and password. Please change the password after your first log in.</> },
  { title: 'Set up your branch page', body: <>Open your branch, click <strong>Edit Home</strong>, and add a warm welcome plus what your chapter offers.</> },
  { title: 'Post your first event', body: <>Go to <strong>Posts → Manage Posts</strong> and add your title, date, age group, location, and sign-up link. It appears instantly on Home and Events for students everywhere.</> },
  { title: 'Share resources', body: <>Under <strong>Manage</strong>, upload worksheets or guides so other branches can benefit from your work.</> },
  { title: 'Compile hours anytime', body: <>Try the <Link to="/platform" className="wire-link">Hour Compiler</Link> after your next event. If two entries refer to the same person, simply select them and click <strong>Merge</strong>. This is a feature that might save you hours of work.</> },
]

export default function Guide(){
  return (
    <div className="container" style={{padding:'28px 20px 40px', maxWidth:900}}>
      <div className="wire-card" style={{padding:'26px 26px 22px', lineHeight:1.7}}>
        <span className="badge">User Guide</span>
        <h1 style={{margin:'12px 0 10px', fontSize:26, lineHeight:1.3}}>AYLUS Accessible Learning Platform</h1>
        <p style={{margin:'0 0 10px', fontSize:15}}>
          We are excited to introduce the <strong>AYLUS Accessible Learning Platform</strong> — one shared home
          connecting students, volunteers, and instructors across our <strong>196 branches</strong> nationwide!
        </p>
        <p style={{margin:0, fontSize:14, color:'#555'}}>
          New here? This guide walks you through what each tab does and how your branch can get started in minutes.
        </p>
      </div>

      <section aria-label="What the platform offers" style={{marginTop:24}}>
        <h2>What the platform offers</h2>
        <p style={{margin:'10px 0 16px', fontSize:14, color:'#444'}}>Functions of each tab:</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:16}}>
          {tabs.map(t=>(
            <div key={t.name} className="wire-card" style={{marginBottom:0, padding:'18px'}}>
              <h3 style={{margin:'0 0 8px', fontSize:15}}>
                <Link to={t.to} className="wire-link" style={{fontSize:15}}>{t.name}</Link>
              </h3>
              <p style={{margin:0, fontSize:13.5, lineHeight:1.65, color:'#333'}}>{t.desc}</p>
            </div>
          ))}
        </div>
        <div className="wire-card" style={{marginTop:16, padding:'14px 18px', fontSize:13.5, background:'#fffdf5'}}>
          <strong>Hour Compiler tip: </strong>
          a feature that might save you hours of work — paste your branch link, pick a date range, and download a clean CSV for service-hour reporting.
        </div>
      </section>

      <div className="divider" />

      <section aria-label="Getting started">
        <h2>Getting started <span style={{fontWeight:400, fontSize:14}}>(branch onboarding)</span></h2>
        <ol style={{margin:'14px 0 0 20px', padding:0, display:'flex', flexDirection:'column', gap:14}}>
          {steps.map((s, i)=>(
            <li key={s.title} className="wire-card" style={{marginBottom:0, padding:'16px 18px', listStyle:'none', marginLeft:0}}>
              <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
                <span style={{
                  flex:'0 0 30px', width:30, height:30, borderRadius:'50%',
                  background:'#dd4444', color:'#fff', display:'inline-flex',
                  alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14
                }}>{i+1}</span>
                <div>
                  <h3 style={{margin:'2px 0 6px', fontSize:15}}>{s.title}</h3>
                  <p style={{margin:0, fontSize:13.5, lineHeight:1.65, color:'#333'}}>{s.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', marginTop:16}}>
          <Link to="/login" className="btn btn-small">Admin Login</Link>
          <Link to="/branches" className="btn btn-small btn-outline">Find My Branch</Link>
          <Link to="/platform" className="btn btn-small btn-outline">Try Hour Compiler</Link>
        </div>
      </section>

      <div className="divider" />

      <section aria-label="Tips">
        <h2>A few tips</h2>
        <div className="wire-card" style={{marginTop:14, padding:'16px 18px'}}>
          <ul style={{margin:'0 0 0 20px', padding:0, fontSize:14, lineHeight:1.7}}>
            <li>Keep event dates accurate so they appear under <strong>Upcoming</strong>. Past events will automatically move to <strong>Completed</strong>.</li>
            <li>If you ever forget your password, click <strong>“Forgot password?”</strong> on the <Link to="/login" className="wire-link">login page</Link> to reset it via email.</li>
          </ul>
        </div>
      </section>

      <div className="wire-card" style={{marginTop:24, padding:'22px', lineHeight:1.7, textAlign:'center'}}>
        <p style={{margin:'0 0 10px', fontSize:14}}>
          We believe every student deserves equal access to educational opportunities, regardless of background.
          Thank you for the heart you put into teaching and volunteering — together, we’ll help students discover
          new interests, build real skills, and reach their full potential.
        </p>
        <p style={{margin:0, fontSize:14}}><em>Warm regards,<br />The AYLUS Accessible Learning Committee</em></p>
      </div>
    </div>
  )
}
