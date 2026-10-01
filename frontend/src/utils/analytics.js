// Lightweight first-party analytics beacon (backs the admin dashboard).
// Microsoft Clarity covers heatmaps/session replay; this covers the exact
// counts requested: daily pageviews, password changes, admin logins, top branches/pages.
function currentBranchId() {
  try {
    const s = localStorage.getItem('aylus_user')
    if (!s) return null
    return JSON.parse(s)?.branchId || null
  } catch {
    return null
  }
}

function currentBranchToken() {
  return localStorage.getItem('aylus_token') || null
}

export function trackEvent(eventType, data = {}) {
  try {
    const payload = JSON.stringify({
      eventType,
      path: data.path || window.location.pathname,
      branchId: data.branchId !== undefined ? data.branchId : currentBranchId(),
      ...(data.meta ? { meta: data.meta } : {}),
    })
    const headers = { 'Content-Type': 'application/json' }
    const token = currentBranchToken()
    // let the backend prefer the JWT-derived branchId when available
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      // sendBeacon can't set Authorization header — fall back to fetch when logged in
      if (!token && navigator.sendBeacon('/api/analytics/track', blob)) return
    }
    fetch('/api/analytics/track', {
      method: 'POST',
      headers,
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // analytics must never break the UI
  }
}

export function trackPageview(path) {
  trackEvent('pageview', { path: path || window.location.pathname })
}
