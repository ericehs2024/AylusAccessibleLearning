// Centralized date helpers — ALL user-facing times MUST go through these so they
// are rendered in the user's browser timezone (not UTC, not server time).
//
// Why: raw `new Date(iso).toLocaleString()` already uses browser TZ, but we make
// it explicit and consistent, and we fix the datetime-local <-> UTC conversion
// so a value entered as "2026-09-24T10:30" in the browser is stored as the
// correct UTC instant and rendered back as local time.

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// Format a date-only string in browser timezone.
// Example: 2026-09-24T14:00:00.000Z in PDT -> "9/24/2026" (or locale equivalent)
export function formatDate(value) {
  const d = toDate(value)
  if (!d) return 'Date TBD'
  const tz = getBrowserTimeZone()
  // Explicit timeZone ensures we stay in browser TZ even if runtime defaults differ
  if (tz) {
    return d.toLocaleDateString(undefined, { timeZone: tz })
  }
  return d.toLocaleDateString()
}

// Format date + time in browser timezone
export function formatDateTime(value) {
  const d = toDate(value)
  if (!d) return ''
  const tz = getBrowserTimeZone()
  if (tz) {
    return d.toLocaleString(undefined, { timeZone: tz })
  }
  return d.toLocaleString()
}

// Convert an ISO/UTC value (e.g. 2026-09-24T17:30:00.000Z) to a
// `datetime-local` input value (YYYY-MM-DDTHH:mm) in the browser's local time.
// Used to populate <input type="datetime-local"> when editing.
export function toLocalDateTimeInputValue(value) {
  const d = toDate(value)
  if (!d) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

// Convert a `datetime-local` input value (YYYY-MM-DDTHH:mm, which has NO timezone)
// to an ISO UTC string (e.g. 2026-09-24T17:30:00.000Z) interpreted in the
// browser's local timezone. Send this to the backend for storage.
export function fromLocalDateTimeInputValue(localValue) {
  if (!localValue) return undefined
  const d = new Date(localValue)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}
