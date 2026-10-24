// Run: node scripts/inspect-seed.mjs [--write-csv]
import fs from 'node:fs'
import { makeSeedDb } from '../src/data/index.js'
import { CONFIG } from '../src/config.js'
import { statusOf, totalOf, outstandingOf, summary, forecast, coverGap, priorityList, followUps, customerStats } from '../src/lib/ledger.js'
import { inr } from '../src/lib/money.js'
import { parseCsv, matchRows } from '../src/lib/matching.js'
import { addDays } from '../src/lib/dates.js'

const db = makeSeedDb()
const today = CONFIG.demoToday
const cust = (id) => db.customers.find((c) => c.id === id).name

console.log('invoices:', db.invoices.length)
const counts = {}
for (const i of db.invoices) counts[statusOf(db, i, today)] = (counts[statusOf(db, i, today)] || 0) + 1
console.log('status counts', counts)
console.table(db.invoices.filter((i) => outstandingOf(db, i) > 0).map((i) => ({ no: i.number, cust: cust(i.customerId).slice(0, 18), due: i.dueDate, total: inr(totalOf(db, i)), out: inr(outstandingOf(db, i)), status: statusOf(db, i, today), key: i.key })))
console.log('summary', summary(db, today))

const fc = forecast(db, today)
console.table(fc.weeks.map((w) => ({ w: w.index + 1, start: w.start, open: inr(w.opening), in: inr(w.in), out: inr(w.out), close: inr(w.closing) })))
console.log('lowest wk', fc.lowest.index + 1, inr(fc.lowest.closing), 'first below buffer', fc.firstBelow?.index + 1, 'shortfall', inr(fc.shortfall))
const gap = coverGap(db, today, fc)
console.log('cover gap', gap.picks.map((p) => `${p.inv.number} ${inr(p.amountPaise)}`), gap.covered)
console.log('chase', priorityList(db, today, fc).slice(0, 6).map((r) => `${r.inv.number} score ${r.score} ${inr(r.out)} ${r.od}d ${r.grade}`))
console.log('followups', followUps(db, today).map((f) => `${cust(f.customerId)} ${f.stage.id} x${f.invoiceIds.length}`))
console.log('grades', db.customers.map((c) => `${c.name.slice(0, 10)}:${customerStats(db, c, today).grade}`).join(' '))

// Sample bank statement built from the keyed invoices
const k = Object.fromEntries(db.invoices.filter((i) => i.key).map((i) => [i.key, i]))
if (process.argv.includes('--write-csv')) {
  const taxable = (inv) => {
    const out = outstandingOf(db, inv)
    return { out }
  }
  void taxable
  const { calcOf } = await import('../src/lib/ledger.js')
  const o = (key) => outstandingOf(db, k[key])
  const short2 = Math.round((calcOf(db, k.tds).taxable * 2) / 100)
  const rows = [
    [addDays(today, -2), `NEFT/PATIL FOODS PVT LTD/${k.exact.number}`, 0, o('exact'), 'N2610230001'],
    [addDays(today, -2), 'NEFT/AMBIKA PAPER MILLS/KRAFT SEP', 28_00_000_00 / 100 * 0 + 0, 0, ''],
    [addDays(today, -1), `RTGS/GUJARAT SNACKS CO/${k.part.number} PART`, 0, Math.round(o('part') / 2 / 100) * 100, 'R2610220118'],
    [addDays(today, -1), `NEFT/BHOSALE GARMENTS/INV 26-27 ${String(k.multi1.number.split('/').pop())} ${String(k.multi2.number.split('/').pop())}`, 0, o('multi1') + o('multi2'), 'N2610220245'],
    [today, `NEFT/KULKARNI ELECTRICALS/${k.tds.number}`, 0, o('tds') - short2, 'N2610230377'],
    [today, `NEFT/RAJ PHARMA DISTRIBUTORS/${k.over.number}`, 0, o('over') + 5_000_00, 'N2610230412'],
    [today, 'UPI/430281/RANDOM TRADERS/PAYMENT', 0, 7_500_00, 'U2610230990'],
  ].filter((r) => r[2] || r[3])
  const fmt = (p) => (p / 100).toFixed(2)
  const lines = ['Date,Description,Debit,Credit,Reference', ...rows.map((r) => `${r[0]},${r[1]},${r[2] ? fmt(r[2]) : ''},${r[3] ? fmt(r[3]) : ''},${r[4]}`)]
  fs.writeFileSync(new URL('../src/data/bank-statement.csv', import.meta.url), lines.join('\n') + '\n')
  console.log('wrote bank-statement.csv')
}
const csvPath = new URL('../src/data/bank-statement.csv', import.meta.url)
if (fs.existsSync(csvPath)) {
  const m = matchRows(db, parseCsv(fs.readFileSync(csvPath, 'utf8')), today)
  console.table(m.map((x) => ({ desc: x.row.description.slice(0, 45), amt: inr(x.row.creditPaise), cust: x.customerId, alloc: x.allocations.map((a) => db.invoices.find((i) => i.id === a.invoiceId).number.slice(-4) + ':' + inr(a.amountPaise)).join(' '), excess: inr(x.excessPaise), flags: x.flags.join(','), conf: x.confidence.toFixed(2), why: x.reasons.join(',') })))
}
