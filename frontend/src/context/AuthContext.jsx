import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('aylus_user')
    return s ? JSON.parse(s) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('aylus_token'))

  useEffect(() => {
    if (token) localStorage.setItem('aylus_token', token)
    else localStorage.removeItem('aylus_token')
  }, [token])
  useEffect(() => {
    if (user) localStorage.setItem('aylus_user', JSON.stringify(user))
    else localStorage.removeItem('aylus_user')
  }, [user])

  const login = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
  }
  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
