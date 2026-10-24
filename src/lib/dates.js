// Dates are ISO 'YYYY-MM-DD' strings in IST. No time-of-day anywhere.
const DAY = 86400000

export function istToday() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (iso, n) => toIso(parse(iso) + n * DAY)
// whole days: a minus b
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY)

export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return toIso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)))
}

const fmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtShort = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
export const fmtDate = (iso) => (iso ? fmt.format(parse(iso)) : '')
export const fmtDateShort = (iso) => (iso ? fmtShort.format(parse(iso)) : '')

// Financial year runs 1 Apr to 31 Mar. 2026-10-23 -> '26-27'
export function financialYear(iso) {
  const [y, m] = iso.split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  const yy = (n) => String(n % 100).padStart(2, '0')
  return `${yy(start)}-${yy(start + 1)}`
}
export const dayOfMonth = (iso) => Number(iso.slice(8, 10))
