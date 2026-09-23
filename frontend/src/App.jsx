import React from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import OrgHome from './pages/OrgHome'
import Upcoming from './pages/Upcoming'
import PastEvents from './pages/PastEvents'
import Resources from './pages/Resources'
import MyBranch from './pages/MyBranch'
import Branches from './pages/Branches'
import BranchHome from './pages/BranchHome'
import BranchPosts from './pages/BranchPosts'
import PostDetail from './pages/PostDetail'
import Login from './pages/Login'
import AdminHomeEditor from './pages/AdminHomeEditor'
import AdminPostsEditor from './pages/AdminPostsEditor'
import AdminResourcesEditor from './pages/AdminResourcesEditor'
import ChangePassword from './pages/ChangePassword'
import ForgotPassword from './pages/ForgotPassword'
import Admin from './pages/Admin'
import { useAuth } from './context/AuthContext'
import { useTheme } from './context/ThemeContext'
import VoronoiBackground from './components/VoronoiBackground'

function SleekSwitch({ checked, onToggle }){
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={checked ? 'Switch to light mode' : 'Switch to dark mode'}
      title={checked ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle}
      onKeyDown={e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); onToggle() } }}
      style={{
        position:'absolute',
        left:14,
        top:14,
        zIndex:5,
        width:56,
        height:30,
        borderRadius:999,
        border: `1.5px solid ${checked ? '#3a3a3a' : '#111'}`,
        background: checked ? '#1a1a1a' : '#fff',
        boxShadow: checked ? '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)' : '0 2px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        display:'flex',
        alignItems:'center',
        padding:3,
        cursor:'pointer',
        transition:'background .25s, border-color .25s, box-shadow .25s',
      }}
    >
      <span
        aria-hidden
        style={{
          width:24,
          height:24,
          borderRadius:999,
          background: checked ? '#e6e6e6' : '#111',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 1px 1px rgba(0,0,0,0.2)',
          transform: checked ? 'translateX(26px)' : 'translateX(0)',
          transition:'transform .28s cubic-bezier(.2,.8,.2,1), background .25s',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          color: checked ? '#111' : '#f5c518',
        }}
      >
        {/* SVG icons */}
        {checked ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </span>
    </button>
  )
}

function SiteHeader(){
  const { toggle, isDark } = useTheme()
  return (
    <div className="wire-site-header" style={{position:'relative'}}>
      <SleekSwitch checked={isDark} onToggle={toggle} />
      <div className="wire-title">AYLUS ACCESSIBLE LEARNING</div>
      <div className="site-tagline">Leadership &nbsp;·&nbsp; Integrity &nbsp;·&nbsp; Innovation</div>
    </div>
  )
}

function Navbar(){
  const loc = useLocation()
  const nav = useNavigate()
  const { user } = useAuth()
  const isActiveStrict = (p) => loc.pathname === p || loc.pathname.startsWith(p + '/')
  const isMyBranchActive = loc.pathname === '/my-branch' || loc.pathname.startsWith('/branch/')
  const isAllBranchesActive = loc.pathname === '/branches' || loc.pathname.startsWith('/branches/')

  const handleMyBranch = (e) => {
    e.preventDefault()
    if(user && user.branchId){
      nav(`/branch/${user.branchId}`)
    } else {
      nav('/my-branch')
    }
  }

  return (
    <nav className="wire-navbar">
      <div className="wire-nav-inner">
        <Link to="/" className={`wire-nav-item ${loc.pathname==='/' ? 'active' : ''}`}>HOME</Link>
        <Link to="/upcoming" className={`wire-nav-item ${isActiveStrict('/upcoming') ? 'active' : ''}`}>Upcoming</Link>
        <Link to="/past" className={`wire-nav-item ${isActiveStrict('/past') ? 'active' : ''}`}>Past events</Link>
        <a href="/my-branch" onClick={handleMyBranch} className={`wire-nav-item ${isMyBranchActive ? 'active' : ''}`}>My branch</a>
        <Link to="/branches" className={`wire-nav-item ${isAllBranchesActive ? 'active' : ''}`}>All branches</Link>
        <Link to="/resources" className={`wire-nav-item ${isActiveStrict('/resources') ? 'active' : ''}`}>Resources</Link>
      </div>
    </nav>
  )
}

function HeroHeader(){
  // Wireframe: no large hero — minimal accessible tagline only, hidden to stay faithful
  return null
}

export default function App(){
  return (
    <>
      <VoronoiBackground />
      <SiteHeader/>
      <Navbar/>
      <main style={{flex:1, display:'flex', flexDirection:'column'}}>
        <Routes>
          <Route path="/" element={<OrgHome/>} />
          <Route path="/upcoming" element={<Upcoming/>} />
          <Route path="/past" element={<PastEvents/>} />
          <Route path="/my-branch" element={<MyBranch/>} />
          <Route path="/resources" element={<Resources/>} />
          <Route path="/branches" element={<Branches/>} />
          {/* canonical wireframe URL: /branches/:branchId/posts/:postId */}
          <Route path="/branches/:branchId/posts/:postId" element={<PostDetail/>} />
          {/* legacy/supporting routes */}
          <Route path="/post/:postId" element={<PostDetail/>} />
          <Route path="/branch/:branchId/post/:postId" element={<PostDetail/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/forgot-password" element={<ForgotPassword/>} />
          <Route path="/change-password" element={<ChangePassword/>} />
          <Route path="/admin" element={<Admin/>} />
          <Route path="/branch/:id" element={<BranchHome/>} />
          <Route path="/branch/:id/posts" element={<BranchPosts/>} />
          <Route path="/branch/:id/admin/home" element={<AdminHomeEditor/>} />
          <Route path="/branch/:id/admin/posts" element={<AdminPostsEditor/>} />
          <Route path="/branch/:id/admin/resources" element={<AdminResourcesEditor/>} />
        </Routes>
      </main>
      <footer style={{textAlign:'center', padding:'32px', fontSize:13}}>
        © {new Date().getFullYear()} Aylus Accessible Learning • Non-profit Organization
      </footer>
    </>
  )
}
