import React, { useEffect, useRef } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import OrgHome from './pages/OrgHome'
import Events from './pages/Events'
import Volunteers from './pages/Volunteers'
import Resources from './pages/Resources'
import Guide from './pages/Guide'
import Platform from './pages/Platform'
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
import { trackPageview } from './utils/analytics'

// Logs one pageview per route change for the admin analytics dashboard
function RouteTracker(){
  const loc = useLocation()
  const last = useRef(null)
  useEffect(()=>{
    if (last.current !== loc.pathname) {
      last.current = loc.pathname
      trackPageview(loc.pathname)
    }
  }, [loc.pathname])
  return null
}

function SiteHeader(){
  return (
    <div className="wire-site-header">
      <div className="wire-title">AYLUS ACCESSIBLE LEARNING</div>
      <div className="site-tagline">Leadership &nbsp;·&nbsp; Integrity &nbsp;·&nbsp; Innovation</div>
    </div>
  )
}

function Navbar(){
  const loc = useLocation()
  const isActiveStrict = (p) => loc.pathname === p || loc.pathname.startsWith(p + '/')
  const isEventsActive = loc.pathname === '/events' || loc.pathname === '/upcoming' || loc.pathname === '/past'
  const isBranchesActive = loc.pathname === '/branches' || loc.pathname === '/my-branch' || loc.pathname.startsWith('/branch/') || loc.pathname.startsWith('/branches/')
  const isHourCompilerActive = loc.pathname === '/platform' || loc.pathname.startsWith('/platform/') || loc.pathname === '/hour-compiler' || loc.pathname.startsWith('/hour-compiler')

  return (
    <nav className="wire-navbar">
      <div className="wire-nav-inner">
        <Link to="/" className={`wire-nav-item ${loc.pathname==='/' ? 'active' : ''}`}>HOME</Link>
        <Link to="/branches" className={`wire-nav-item ${isBranchesActive ? 'active' : ''}`}>Branches</Link>
        <Link to="/events" className={`wire-nav-item ${isEventsActive ? 'active' : ''}`}>Events</Link>
        <Link to="/volunteers" className={`wire-nav-item ${isActiveStrict('/volunteers') ? 'active' : ''}`}>Volunteers</Link>
        <Link to="/resources" className={`wire-nav-item ${isActiveStrict('/resources') ? 'active' : ''}`}>Resources</Link>
        <Link to="/platform" className={`wire-nav-item ${isHourCompilerActive ? 'active' : ''}`}>Hour Compiler</Link>
        <Link to="/guide" className={`wire-nav-item ${loc.pathname==='/guide' ? 'active' : ''}`}>Guide</Link>
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
      <SiteHeader/>
      <Navbar/>
      <RouteTracker/>
      <main style={{flex:1, display:'flex', flexDirection:'column'}}>
        <Routes>
          <Route path="/" element={<OrgHome/>} />
          <Route path="/events" element={<Events/>} />
          <Route path="/volunteers" element={<Volunteers/>} />
          {/* legacy URLs keep working, redirect into unified Events tabs */}
          <Route path="/upcoming" element={<Navigate to="/events" replace />} />
          <Route path="/past" element={<Navigate to="/events?tab=past" replace />} />
          {/* legacy my-branch URL lands on combined Branches page (My Branch pinned at top) */}
          <Route path="/my-branch" element={<Navigate to="/branches" replace />} />
          <Route path="/resources" element={<Resources/>} />
          <Route path="/guide" element={<Guide/>} />
          <Route path="/platform" element={<Platform/>} />
          <Route path="/hour-compiler" element={<Platform/>} />
          <Route path="/hour-compiler/*" element={<Platform/>} />
          <Route path="/platform/*" element={<Platform/>} />
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
        © {new Date().getFullYear()} Aylus Accessible Learning • Non-profit Organization • <Link to="/guide" style={{color:'#fff', fontWeight:700}}>User Guide</Link>
      </footer>
    </>
  )
}
