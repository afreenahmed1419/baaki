// Run: node scripts/check-scan.mjs — photo-to-invoice mapping, using a made-up model reply (no API call).
import { makeSeedDb } from '../src/data/index.js'
import { mapScan } from '../src/lib/scan.js'
import { makeGstin } from '../src/lib/gst.js'

let fails = 0
const ok = (n, c, x = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x) }
const db = makeSeedDb()
const patil = db.customers.find((c) => c.id === 'c1')

// 1. clean read of an existing customer: GST adds up, nothing flagged except what the model said
let m = mapScan({
  invoiceNumber: 'OLD/118', invoiceDate: '2026-10-01', dueDate: '2026-10-31', customerName: 'Patil Foods Pvt Ltd', customerGstin: patil.gstin,
  items: [{ description: 'Carton', hsn: '4819', qty: 1000, unit: 'pcs', rate: 42, discountPct: 0, gstRate: 5 }],
  printed: { taxableValue: 42000, total: 44100 }, uncertain: ['items[0].rate'],
}, db)
ok('matches existing customer by GSTIN', m.customerId === 'c1')
ok('keeps invoice number', m.number === 'OLD/118')
ok('uncertain field flagged', m.flags.has('i0.rate'))
ok('totals agree -> no warnings', m.warnings.length === 0, JSON.stringify(m.warnings))

// 2. printed total disagrees with the items
m = mapScan({ customerName: 'Patil Foods Pvt Ltd', customerGstin: patil.gstin, items: [{ description: 'Carton', hsn: '4819', qty: 1000, unit: 'pcs', rate: 42, gstRate: 5 }], printed: { total: 50000 } }, db)
ok('total mismatch warned and flagged', m.warnings.some((w) => w.key === 'scan.warnTotal') && m.flags.has('printed.total'))

// 3. bad GSTIN check digit is flagged
const good = makeGstin('27AAZZZ9999Z1Z')
const bad = good.slice(0, 14) + (good[14] === 'A' ? 'B' : 'A')
m = mapScan({ customerName: 'New Buyer', customerGstin: bad, items: [] }, db)
ok('failed check digit flagged', m.flags.has('customerGstin') && m.warnings.some((w) => w.key === 'scan.warnGstin'))
ok('unknown customer offered as new', m.customerId === '' && m.newCustomer.name === 'New Buyer')
ok('no items warns', m.warnings.some((w) => w.key === 'scan.warnNoItems'))

// 4. missing fields are flagged, unknown GST rate falls back and is flagged
m = mapScan({ customerName: 'X', items: [{ description: 'Thing', hsn: null, qty: null, rate: null, gstRate: 12 }] }, db)
ok('missing hsn/qty/rate flagged', ['i0.hsn', 'i0.qty', 'i0.rate'].every((k) => m.flags.has(k)))
ok('unsupported GST rate flagged', m.flags.has('i0.gstRate'))

// 5. other-state customer: IGST used when recomputing
const guj = db.customers.find((c) => c.id === 'c3')
m = mapScan({ customerName: guj.name, customerGstin: guj.gstin, items: [{ description: 'Carton', hsn: '4819', qty: 1000, rate: 100, gstRate: 18 }], printed: { total: 118000 } }, db)
ok('IGST total 1,18,000 accepted', !m.warnings.some((w) => w.key === 'scan.warnTotal'))

console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
