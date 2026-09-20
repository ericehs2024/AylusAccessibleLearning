import axios from 'axios'

const api = axios.create({ baseURL: '' })

const ADMIN_TOKEN_KEY = 'aylus_admin_token'
const BRANCH_TOKEN_KEY = 'aylus_token'

api.interceptors.request.use(cfg => {
  // If caller already set Authorization (e.g. Admin.jsx), respect it — don't overwrite
  if (cfg.headers?.Authorization) return cfg

  const url = cfg.url || ''
  // Admin routes must use admin token only — never branch token
  if (url.includes('/api/admin')) {
    const at = localStorage.getItem(ADMIN_TOKEN_KEY)
    if (at) cfg.headers.Authorization = `Bearer ${at}`
    return cfg
  }

  // All other /api routes use branch token
  const t = localStorage.getItem(BRANCH_TOKEN_KEY)
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

export default api
