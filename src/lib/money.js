// Money is always whole paise (integers). Never use decimals for money.
const nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "1,234.50" -> 123450. Returns null if not a valid rupee amount. Exact: no float maths.
export function parseRupees(str) {
  const s = String(str ?? '').trim().replace(/[₹,\s]/g, '')
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!m) return null
  const paise = parseInt(m[2], 10) * 100 + (m[3] ? parseInt(m[3].padEnd(2, '0'), 10) : 0)
  return m[1] ? -paise : paise
}

// Display: ₹1,00,000 (paise shown only when non-zero)
export function inr(p) {
  const a = Math.abs(p)
  const body = a % 100 === 0 ? nf.format(a / 100) : nf2.format(a / 100)
  return (p < 0 ? '-' : '') + '₹' + body
}
// Always two decimals (invoices)
export function inr2(p) {
  return (p < 0 ? '-' : '') + '₹' + nf2.format(Math.abs(p) / 100)
}
// Number with Indian grouping and 2 decimals, no symbol (tables)
export const num2 = (p) => nf2.format(p / 100)

// Short form for charts: 1.2L, 3.4Cr
export function inrShort(p) {
  const r = Math.abs(p) / 100
  const sign = p < 0 ? '-' : ''
  if (r >= 1e7) return `${sign}₹${(r / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`
  if (r >= 1e5) return `${sign}₹${(r / 1e5).toFixed(1).replace(/\.0$/, '')}L`
  if (r >= 1e3) return `${sign}₹${(r / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return `${sign}₹${Math.round(r)}`
}

// Integer division rounding half up, exact for non-negative integers.
export function roundDiv(n, d) {
  return Math.floor((2 * n + d) / (2 * d))
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below1000(n) {
  const parts = []
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)] + ' Hundred')
    n %= 100
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))
  else if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

export function wordsIndian(n) {
  if (n === 0) return 'Zero'
  const parts = []
  const crore = Math.floor(n / 1e7)
  n %= 1e7
  const lakh = Math.floor(n / 1e5)
  n %= 1e5
  const thousand = Math.floor(n / 1e3)
  n %= 1e3
  if (crore) parts.push(wordsIndian(crore) + ' Crore')
  if (lakh) parts.push(below1000(lakh) + ' Lakh')
  if (thousand) parts.push(below1000(thousand) + ' Thousand')
  if (n) parts.push(below1000(n))
  return parts.join(' ')
}

// 11800000 paise -> "Rupees One Lakh Eighteen Thousand Only"
export function amountInWords(paise) {
  const rupees = Math.floor(Math.abs(paise) / 100)
  const ps = Math.abs(paise) % 100
  let s = 'Rupees ' + wordsIndian(rupees)
  if (ps) s += ' and ' + wordsIndian(ps) + ' Paise'
  return s + ' Only'
}
