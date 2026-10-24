// Run: node scripts/check-gst.mjs  — accuracy checks for GST, money, GSTIN, invoice numbers.
import { calcInvoice, makeGstin, validateGstin, nextInvoiceNumber } from '../src/lib/gst.js'
import { amountInWords, parseRupees, inr } from '../src/lib/money.js'
import { financialYear } from '../src/lib/dates.js'

const biz = { stateCode: '27', registration: 'regular' }
const item = (qty, rate, gstRate, discountPct = 0) => ({ qty, ratePaise: rate * 100, gstRate, discountPct })
let fails = 0
const rows = []
function expect(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fails++
  rows.push([ok ? 'PASS' : 'FAIL', name, JSON.stringify(expected), JSON.stringify(actual)])
}

let r = calcInvoice([item(1, 10000, 18)], biz, '27')
expect('10,000 @18% same state', [r.cgst, r.sgst, r.igst, r.total], [90000, 90000, 0, 1180000])
r = calcInvoice([item(1, 10000, 18)], biz, '24')
expect('10,000 @18% other state', [r.cgst, r.sgst, r.igst, r.total], [0, 0, 180000, 1180000])
r = calcInvoice([item(3, 333, 5)], biz, '27')
// taxable 99900; 5% = 4995; each half 2497.5 -> 2498 -> total pre-round 99900+4996=104896 -> 1049 rupees
expect('3 x 333 @5% same state', [r.taxable, r.cgst, r.sgst, r.preRound, r.total, r.roundOff], [99900, 2498, 2498, 104896, 104900, 4])
r = calcInvoice([item(1, 10000, 18, 10)], biz, '27')
expect('10% discount', [r.taxable, r.cgst, r.sgst, r.total], [900000, 81000, 81000, 1062000])
r = calcInvoice([item(1, 10000, 18)], { stateCode: '27', registration: 'composition' }, '27')
expect('composition: no GST', [r.docType, r.tax, r.total], ['bill_of_supply', 0, 1000000])
r = calcInvoice([item(1, 10000, 0)], biz, '27')
expect('0% item', [r.tax, r.total], [0, 1000000])
r = calcInvoice([item(1, 10000, 18)], { stateCode: '27', registration: 'unregistered' }, '27')
expect('unregistered: plain invoice', [r.docType, r.tax], ['invoice', 0])

expect('words 1,18,000', amountInWords(11800000), 'Rupees One Lakh Eighteen Thousand Only')
expect('words 12,34,56,789', amountInWords(123456789 * 100), 'Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only')
expect('inr format', inr(10000000), '₹1,00,000')
expect('parseRupees exact', [parseRupees('1,234.5'), parseRupees('0.07'), parseRupees('abc')], [123450, 7, null])
expect('FY', [financialYear('2026-03-31'), financialYear('2026-04-01'), financialYear('2026-10-23')], ['25-26', '26-27', '26-27'])
expect('next invoice number', nextInvoiceNumber(['INV/26-27/0009', 'INV/25-26/0400'], '26-27'), 'INV/26-27/0010')
expect('new FY restarts', nextInvoiceNumber(['INV/26-27/0009'], '27-28'), 'INV/27-28/0001')

const g = makeGstin('27AABCS1234A1Z')
expect('made GSTIN valid', validateGstin(g).ok, true)
let allBad = true
for (let i = 0; i < 15; i++) {
  const c = g[i] === 'B' ? 'C' : 'B'
  const mutated = g.slice(0, i) + c + g.slice(i + 1)
  if (validateGstin(mutated).ok && !(i < 2)) allBad = false
}
expect('one-char changes fail', allBad, true)
expect('bad length', validateGstin('27AAB').ok, false)

console.table(rows.map(([s, n, e, a]) => ({ s, n, expected: e, actual: s === 'PASS' ? '' : a })))
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
