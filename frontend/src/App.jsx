import React from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import OrgHome from './pages/OrgHome'
import Upcoming from './pages/Upcoming'
import PastEvents from './pages/PastEvents'
import Resources from './pages/Resources'
import Platform from './pages/Platform'
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
  const nav = useNavigate()
  const { user } = useAuth()
  const isActiveStrict = (p) => loc.pathname === p || loc.pathname.startsWith(p + '/')
  const isMyBranchActive = loc.pathname === '/my-branch' || loc.pathname.startsWith('/branch/')
  const isAllBranchesActive = loc.pathname === '/branches' || loc.pathname.startsWith('/branches/')
  const isHourCompilerActive = loc.pathname === '/platform' || loc.pathname.startsWith('/platform/') || loc.pathname === '/hour-compiler' || loc.pathname.startsWith('/hour-compiler')

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
        <Link to="/platform" className={`wire-nav-item ${isHourCompilerActive ? 'active' : ''}`}>Hour Compiler</Link>
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
      <main style={{flex:1, display:'flex', flexDirection:'column'}}>
        <Routes>
          <Route path="/" element={<OrgHome/>} />
          <Route path="/upcoming" element={<Upcoming/>} />
          <Route path="/past" element={<PastEvents/>} />
          <Route path="/my-branch" element={<MyBranch/>} />
          <Route path="/resources" element={<Resources/>} />
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
        © {new Date().getFullYear()} Aylus Accessible Learning • Non-profit Organization
      </footer>
    </>
  )
}
