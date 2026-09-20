import React, { createContext, useContext, useState, useEffect } from 'react'

const ADMIN_TOKEN_KEY = 'aylus_admin_token'

const AdminContext = createContext(null)
export const useAdmin = () => useContext(AdminContext)

export function AdminProvider({ children }) {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY))

  useEffect(() => {
    if (adminToken) localStorage.setItem(ADMIN_TOKEN_KEY, adminToken)
    else localStorage.removeItem(ADMIN_TOKEN_KEY)
  }, [adminToken])

  // keep in sync if another tab changes token
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ADMIN_TOKEN_KEY) setAdminToken(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const adminLogin = (newToken) => setAdminToken(newToken)
  const adminLogout = () => setAdminToken(null)

  return (
    <AdminContext.Provider value={{ adminToken, adminLogin, adminLogout, isAdminAuthed: !!adminToken }}>
      {children}
    </AdminContext.Provider>
  )
}
