import { CONFIG } from '../config.js'
import { calcInvoice, validateGstin } from './gst.js'
import { parseRupees } from './money.js'

export const SCAN_MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'application/pdf']

const toBase64 = (buf) => {
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// Shrink big photos before upload (keeps requests small and fast). PDFs are sent as they are.
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
  return blob
}

export async function readInvoiceFile(file) {
  if (!TYPES.includes(file.type)) throw new Error('unsupported_type')
  if (file.size > SCAN_MAX_BYTES) throw new Error('too_large')
  let mediaType = file.type
  let blob = file
  if (file.type !== 'application/pdf') {
    try { blob = await shrinkImage(file); mediaType = 'image/jpeg' } catch { /* send original */ }
  } else if (file.size > 3.2 * 1024 * 1024) {
    throw new Error('pdf_too_large') // serverless hosts cap request bodies (about 4.5 MB)
  }
  const data = toBase64(await blob.arrayBuffer())
  let res
  try {
    res = await fetch('/api/read-invoice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mediaType, data }) })
  } catch { throw new Error('network') }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'ai_failed')
  return json
}

const snapRate = (r) => {
  if (r == null) return null
  const n = Number(r)
  return CONFIG.gstRates.includes(n) ? n : null
}
const rupeesToString = (n) => (n == null || Number.isNaN(Number(n)) ? '' : String(Number(n)))
const flagKey = (k) => String(k).replace(/items\[(\d+)\]\.(\w+)/, 'i$1.$2')

// Turn the model's answer into form values. Anything missing or uncertain is flagged for the owner.
export function mapScan(scan, db) {
  const flags = new Set((scan.uncertain || []).map(flagKey))
  const warnings = []
  const items = (scan.items || []).map((it, i) => {
    const rate = snapRate(it.gstRate)
    if (it.hsn == null || it.hsn === '') flags.add(`i${i}.hsn`)
    if (it.qty == null) flags.add(`i${i}.qty`)
    if (it.rate == null) flags.add(`i${i}.rate`)
    if (rate == null) flags.add(`i${i}.gstRate`)
    return {
      description: it.description || '', hsn: String(it.hsn || '').replace(/\D/g, ''), qty: rupeesToString(it.qty ?? 1) || '1',
      unit: it.unit || 'pcs', rate: rupeesToString(it.rate), discountPct: rupeesToString(it.discountPct ?? 0) || '0', gstRate: rate ?? 18,
    }
  })

  // customer: match by GSTIN, else by name
  const gstin = (scan.customerGstin || '').toUpperCase().replace(/\s/g, '')
  let customerId = ''
  if (gstin) customerId = db.customers.find((c) => c.gstin === gstin)?.id || ''
  if (!customerId && scan.customerName) {
    const n = scan.customerName.toLowerCase()
    customerId = db.customers.find((c) => c.name.toLowerCase() === n || n.includes(c.name.toLowerCase()))?.id || ''
  }
  let gstinCheck = null
  if (gstin) {
    gstinCheck = validateGstin(gstin)
    if (!gstinCheck.ok) { flags.add('customerGstin'); warnings.push({ key: 'scan.warnGstin', vars: { gstin } }) }
  }
  if (!scan.customerName) flags.add('customerName')

  const matched = db.customers.find((c) => c.id === customerId)
  const placeStateCode = matched?.stateCode || (gstinCheck?.ok ? gstinCheck.stateCode : db.business.stateCode)

  // recompute tax from the items and compare with the printed totals
  const parsed = items.map((it) => ({ ...it, qty: Number(it.qty) || 0, ratePaise: parseRupees(it.rate) ?? 0, discountPct: Number(it.discountPct) || 0 }))
  const calc = calcInvoice(parsed, db.business, placeStateCode)
  const p = scan.printed || {}
  const printedTotal = p.total != null ? parseRupees(String(p.total)) : null
  if (printedTotal != null) {
    // the printed total may or may not include the round-off, so allow up to one rupee
    if (Math.abs(printedTotal - calc.total) > 100 && Math.abs(printedTotal - calc.preRound) > 100) {
      flags.add('printed.total')
      warnings.push({ key: 'scan.warnTotal', vars: { printed: printedTotal, calc: calc.total } })
    }
  }
  if (p.taxableValue != null) {
    const pt = parseRupees(String(p.taxableValue))
    if (pt != null && Math.abs(pt - calc.taxable) > 100) {
      flags.add('printed.taxableValue')
      warnings.push({ key: 'scan.warnTaxable', vars: { printed: pt, calc: calc.taxable } })
    }
  }
  if (!items.length) warnings.push({ key: 'scan.warnNoItems', vars: {} })

  return {
    customerId, newCustomer: customerId ? null : { name: scan.customerName || '', address: scan.customerAddress || '', gstin: gstinCheck?.ok ? gstin : (gstin || ''), stateCode: gstinCheck?.ok ? gstinCheck.stateCode : '27' },
    items, issued: scan.invoiceDate || '', dueDate: scan.dueDate || '', number: scan.invoiceNumber || '', flags, warnings,
  }
}
