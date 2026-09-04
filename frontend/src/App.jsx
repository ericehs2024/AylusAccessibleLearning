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

function Navbar(){
  return (
    <nav className="navbar">
      <div className="navbar-inner" style={{justifyContent:'flex-start'}}>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/branches">Branches</Link>
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
      <h1>Aylus Accessible Learning</h1>
      <p>Empowering youth through tutoring, volunteering, and community service — across all branches.</p>
      <p style={{marginTop:14, display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
        <Link to="/" className={`btn btn-small ${onHome ? '' : 'btn-outline'}`} aria-current={onHome ? 'page' : undefined}>Home</Link>
        <Link to="/branches" className={`btn btn-small ${onBranches ? '' : 'btn-outline'}`} aria-current={onBranches ? 'page' : undefined}>Branches</Link>
      </p>
    </div>
  )
}

export default function App(){
  const loc = useLocation()
  const isHeroPage = loc.pathname === '/' || loc.pathname === '/branches'
  return (
    <>
      {isHeroPage ? <HeroHeader/> : <Navbar/>}
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
