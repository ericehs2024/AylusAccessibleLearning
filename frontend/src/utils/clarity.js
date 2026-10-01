// Microsoft Clarity loader. Set VITE_CLARITY_ID in frontend/.env (see .env.example).
// No-op when the id is missing so local builds without Clarity keep working.
let clarityLoaded = false

export function initClarity() {
  if (clarityLoaded) return
  const id = import.meta.env.VITE_CLARITY_ID
  if (!id) return
  clarityLoaded = true
  ;(function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        ;(c[a].q = c[a].q || []).push(arguments)
      }
    t = l.createElement(r)
    t.async = 1
    t.src = 'https://www.clarity.ms/tag/' + i
    y = l.getElementsByTagName(r)[0]
    y.parentNode.insertBefore(t, y)
  })(window, document, 'clarity', 'script', id)
}
