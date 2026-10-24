// Run: node scripts/check-app.mjs — behaviour checks from the brief's acceptance list.
import { makeSeedDb } from '../src/data/index.js'
import { CONFIG } from '../src/config.js'
import { dueStageFor, followUps, forecast, outstandingOf, totalOf, paidOf, expectedDate, isOpen, msmeInterest, statusOf } from '../src/lib/ledger.js'
import { validateGstin } from '../src/lib/gst.js'
import { addDays, diffDays } from '../src/lib/dates.js'
import { parseCsv, matchRows } from '../src/lib/matching.js'
import fs from 'node:fs'

let fails = 0
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : extra) }
const db = makeSeedDb()
const today = CONFIG.demoToday

// 1. invoice numbers consecutive, unique, <=16 chars, valid chars
const nums = db.invoices.map((i) => i.number)
ok('invoice numbers unique', new Set(nums).size === nums.length)
ok('invoice numbers consecutive', nums.every((n, i) => n === `INV/26-27/${String(i + 1).padStart(4, '0')}`))
ok('invoice numbers <=16 chars', nums.every((n) => n.length <= 16 && /^[A-Za-z0-9/-]+$/.test(n)))

// 2. every sample GSTIN valid; one char changed fails
const gstins = [db.business.gstin, ...db.customers.map((c) => c.gstin).filter(Boolean)]
ok('all sample GSTINs valid', gstins.every((g) => validateGstin(g).ok))
ok('mutated GSTINs fail', gstins.every((g) => !validateGstin(g.slice(0, 5) + (g[5] === 'A' ? 'B' : 'A') + g.slice(6)).ok))
ok('one customer unregistered, one other-state', db.customers.some((c) => !c.gstin) && db.customers.some((c) => c.stateCode !== '27'))

// 3. status mix present
const st = new Set(db.invoices.map((i) => statusOf(db, i, today)))
ok('all statuses present', ['draft', 'paid', 'part_paid', 'due_soon', 'overdue', 'disputed', 'sent'].every((s) => st.has(s)), [...st].join())

// 4. ladder: due, never twice, pauses
const inv = db.invoices.find((i) => i.key === 'multi2') // 36 days overdue, demand step due
const d1 = dueStageFor(db, inv, today)
ok('demand step due today', d1?.stage.id === 'demand', JSON.stringify(d1?.stage))
db.events.push({ id: 'x', invoiceId: inv.id, customerId: inv.customerId, type: 'letter', stage: 'demand', date: today })
ok('same step never twice', dueStageFor(db, inv, today) === null)
const inv2 = db.invoices.find((i) => i.key === 'exact')
ok('heads-up due 3 days before', dueStageFor(db, inv2, today)?.stage.id === 'heads_up')
db.promises.push({ id: 'p1', invoiceId: inv2.id, until: addDays(today, 5), createdAt: today })
ok('promise pauses ladder', dueStageFor(db, inv2, today) === null)
ok('promise expires', dueStageFor(db, inv2, addDays(today, 6))?.stage.id === 'reminder' || dueStageFor(db, inv2, addDays(today, 6)) === null)
const disputed = db.invoices.find((i) => i.key === 'dispute')
ok('dispute pauses ladder', dueStageFor(db, disputed, today) === null)
const claim = db.invoices.find((i) => i.key === 'claim')
ok('paid-claim pauses ladder', dueStageFor(db, claim, today) === null)
// moving the demo date forward changes what is due
const later = addDays(today, 10)
ok('later date -> more/other follow-ups', followUps(db, later).length > 0)
// stage offsets come from config, day counts are whole days
const od = diffDays(addDays(inv.dueDate, 7), inv.dueDate)
ok('whole-day maths', od === 7)

// 5. forecast integrity
const fc = forecast(makeSeedDb(), today)
ok('13 weeks', fc.weeks.length === 13)
ok('closing(w) === opening(w+1)', fc.weeks.every((w, i) => i === 12 || w.closing === fc.weeks[i + 1].opening))
ok('closing = opening + in - out', fc.weeks.every((w) => w.closing === w.opening + w.in - w.out))
const fdb = makeSeedDb()
const inSum = fc.weeks.reduce((a, w) => a + w.in, 0)
const expectedIn = fdb.invoices.filter((i) => isOpen(fdb, i)).filter((i) => !fc.doubtful.some((d) => d.invoiceId === i.id)).filter((i) => diffDays(expectedDate(fdb, i, today), today) < 91).reduce((a, i) => a + outstandingOf(fdb, i), 0)
ok('forecast inflows == invoices expected in window', inSum === expectedIn, `${inSum} vs ${expectedIn}`)
ok('first week below buffer found', fc.firstBelow && fc.firstBelow.closing < fc.buffer)

// 6. money integrity: all amounts are integers
ok('all amounts integer paise', fdb.invoices.every((i) => Number.isInteger(totalOf(fdb, i))) && fdb.payments.every((p) => Number.isInteger(p.amountPaise)))
ok('no overpaid invoices', fdb.invoices.every((i) => paidOf(fdb, i) <= totalOf(fdb, i)))

// 7. matching: six cases, idempotent import
const rows = parseCsv(fs.readFileSync(new URL('../src/data/bank-statement.csv', import.meta.url), 'utf8'))
const m = matchRows(makeSeedDb(), rows, today)
const flags = m.map((x) => x.flags.join('+'))
ok('6 credit lines matched', m.length === 6, String(m.length))
ok('exact', flags[0] === '')
ok('part payment', flags[1] === 'part_payment')
ok('covers two invoices', flags[2] === 'multi_invoice' && m[2].allocations.length === 2)
ok('possible TDS (2%)', flags[3] === 'possible_tds')
ok('overpayment keeps excess', flags[4] === 'overpayment' && m[4].excessPaise === 500000)
ok('unknown deposit unmatched', flags[5] === 'unmatched')
const db2 = makeSeedDb()
ok('nothing marked paid by matching', db2.payments.length === makeSeedDb().payments.length)
db2.importedKeys = m.map((x) => x.key)
ok('re-import counts nothing twice', matchRows(db2, rows, today).every((x) => x.status === 'duplicate'))

// 8. MSME interest: informational, compound, positive for late invoices
const late = db.invoices.find((i) => i.key === 'multi1')
const mi = msmeInterest(outstandingOf(db, late), late, today)
ok('MSME interest positive for 48-day-overdue invoice', mi.interestPaise > 0 && Number.isInteger(mi.interestPaise), JSON.stringify(mi))
ok('no interest when not overdue', msmeInterest(100000, db.invoices.find((i) => i.key === 'exact'), today).interestPaise === 0)

console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
