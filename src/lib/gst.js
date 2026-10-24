import { roundDiv } from './money.js'

export const STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

// Check character for the first 14 characters of a GSTIN.
export function gstinCheckChar(first14) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const code = CHARS.indexOf(first14[i])
    let v = code * (i % 2 === 0 ? 1 : 2)
    v = Math.floor(v / 36) + (v % 36)
    sum += v
  }
  return CHARS[(36 - (sum % 36)) % 36]
}
// Used only to build made-up sample GSTINs that pass validation.
export const makeGstin = (first14) => first14 + gstinCheckChar(first14)

export function validateGstin(g) {
  const s = String(g || '').trim().toUpperCase()
  if (s.length !== 15) return { ok: false, reason: 'length' }
  if (!PATTERN.test(s)) return { ok: false, reason: 'pattern' }
  if (!STATES[s.slice(0, 2)]) return { ok: false, reason: 'state' }
  if (gstinCheckChar(s.slice(0, 14)) !== s[14]) return { ok: false, reason: 'checkdigit' }
  return { ok: true, stateCode: s.slice(0, 2), state: STATES[s.slice(0, 2)] }
}

// Which document the business issues, from its registration type.
export function docTypeFor(business) {
  if (business.registration === 'regular') return 'tax_invoice'
  if (business.registration === 'composition') return 'bill_of_supply'
  return 'invoice'
}

// One line. gstRate is a whole-number percent. All money in paise.
// discountPct may have decimals: discount = round(gross * pct / 100).
export function calcLine(item, { intra, charge = true }) {
  const qty = Number(item.qty) || 0
  const gross = Math.round(qty * item.ratePaise)
  const discount = Math.round((gross * (Number(item.discountPct) || 0)) / 100)
  const taxable = Math.max(0, gross - discount)
  const rate = charge ? Number(item.gstRate) || 0 : 0
  let cgst = 0, sgst = 0, igst = 0
  if (rate > 0) {
    if (intra) {
      cgst = roundDiv(taxable * rate, 200) // half the rate, each rounded separately
      sgst = roundDiv(taxable * rate, 200)
    } else {
      igst = roundDiv(taxable * rate, 100)
    }
  }
  return { gross, discount, taxable, rate, cgst, sgst, igst, tax: cgst + sgst + igst, total: taxable + cgst + sgst + igst }
}

// Whole invoice. placeStateCode = state of the place of supply (the customer's state).
export function calcInvoice(items, business, placeStateCode) {
  const docType = docTypeFor(business)
  const charge = docType === 'tax_invoice'
  const intra = business.stateCode === placeStateCode
  const lines = items.map((it) => ({ ...calcLine(it, { intra, charge }), item: it }))
  const sum = (k) => lines.reduce((a, l) => a + l[k], 0)
  const taxable = sum('taxable')
  const cgst = sum('cgst'), sgst = sum('sgst'), igst = sum('igst')
  const preRound = taxable + cgst + sgst + igst
  const total = roundDiv(preRound, 100) * 100 // nearest rupee
  const roundOff = total - preRound
  const byRate = {}
  for (const l of lines) {
    const r = (byRate[l.rate] ||= { rate: l.rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 })
    r.taxable += l.taxable; r.cgst += l.cgst; r.sgst += l.sgst; r.igst += l.igst
  }
  return {
    docType, intra, charge, lines, taxable, cgst, sgst, igst, tax: cgst + sgst + igst,
    preRound, roundOff, total, rateSummary: Object.values(byRate).sort((a, b) => a.rate - b.rate),
  }
}

// Invoice numbers: INV/26-27/0001, max 16 chars, consecutive within the financial year.
export function nextInvoiceNumber(existingNumbers, fy) {
  const prefix = `INV/${fy}/`
  let max = 0
  for (const n of existingNumbers) {
    if (n.startsWith(prefix)) max = Math.max(max, parseInt(n.slice(prefix.length), 10) || 0)
  }
  return prefix + String(max + 1).padStart(4, '0')
}
export const isValidInvoiceNumber = (n) => /^[A-Za-z0-9/-]{1,16}$/.test(n)
