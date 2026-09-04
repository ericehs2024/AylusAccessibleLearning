import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import OrgHome from './pages/OrgHome'
import Branches from './pages/Branches'
import BranchHome from './pages/BranchHome'
import BranchPosts from './pages/BranchPosts'
import Login from './pages/Login'
import AdminHomeEditor from './pages/AdminHomeEditor'
import AdminPostsEditor from './pages/AdminPostsEditor'
import ChangePassword from './pages/ChangePassword'

function SiteHeader(){
  return (
    <div className="site-header">
      <a href="https://aylus.org" target="_blank" rel="noreferrer">
        <img src="https://aylus.org/wp-content/uploads/2015/08/aylus_title_red_500x130.jpg" alt="Alliance of Youth Leaders" />
      </a>
      <div className="site-tagline">Leadership &nbsp;·&nbsp; Integrity &nbsp;·&nbsp; Innovation</div>
    </div>
  )
}

function Navbar(){
  const loc = useLocation()
  const isActive = (p) => loc.pathname === p
  return (
    <nav className="navbar">
      <div className="navbar-inner" style={{justifyContent:'flex-start'}}>
        <div className="nav-links">
          <Link to="/" className={isActive('/') ? 'active' : ''}>Home</Link>
          <Link to="/branches" className={isActive('/branches') ? 'active' : ''}>Branches</Link>
        </div>
      </div>
    </nav>
  )
}

function HeroHeader(){
  const loc = useLocation()
  const onHome = loc.pathname === '/'
  const onBranches = loc.pathname === '/branches'
  return (
    <div className="hero">
      <p>Empowering youth through tutoring, volunteering, and community service — across all branches.</p>
      <p style={{marginTop:16, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
        <Link to="/" className={`btn btn-small ${onHome ? '' : 'btn-outline'}`} aria-current={onHome ? 'page' : undefined}>Home</Link>
        <Link to="/branches" className={`btn btn-small ${onBranches ? '' : 'btn-outline'}`} aria-current={onBranches ? 'page' : undefined}>Branches</Link>
      </p>
      <div className="hero-stats">
        <div className="hero-stat"><strong>197</strong><span>Branches Nationwide</span></div>
        <div className="hero-stat"><strong>11</strong><span>Years of Impact</span></div>
        <div className="hero-stat"><strong>100%</strong><span>Student-Run</span></div>
      </div>
    </div>
  )
}

export default function App(){
  const loc = useLocation()
  const isHeroPage = loc.pathname === '/' || loc.pathname === '/branches'
  return (
    <>
      <SiteHeader/>
      {isHeroPage && <HeroHeader/>}
      <Routes>
        <Route path="/" element={<OrgHome/>} />
        <Route path="/branches" element={<Branches/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/change-password" element={<ChangePassword/>} />
        <Route path="/branch/:id" element={<BranchHome/>} />
        <Route path="/branch/:id/posts" element={<BranchPosts/>} />
        <Route path="/branch/:id/admin/home" element={<AdminHomeEditor/>} />
        <Route path="/branch/:id/admin/posts" element={<AdminPostsEditor/>} />
      </Routes>
      <footer style={{textAlign:'center', padding:'32px', color:'#5f6368', fontSize:13}}>
        © {new Date().getFullYear()} Aylus Accessible Learning • Non-profit Organization
      </footer>
    </>
  )
}
