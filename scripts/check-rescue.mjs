// Run: node scripts/check-rescue.mjs — the Cash Rescue Plan and the early-payment offer loop.
import { makeSeedDb } from '../src/data/index.js'
import { CONFIG } from '../src/config.js'
import { buildRescue, discountFor, interestFor } from '../src/lib/rescue.js'
import { forecast, outstandingOf } from '../src/lib/ledger.js'
import { matchRows } from '../src/lib/matching.js'
import { addDays } from '../src/lib/dates.js'

let fails = 0
const ok = (n, c, x = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x) }
const today = CONFIG.demoToday
const db = makeSeedDb()
const plan = buildRescue(db, today)

ok('there is a gap to rescue', plan.needed && plan.base.shortfall > 0)
ok('plan re-tested against the forecast: gap closed', plan.closed && !plan.final.firstBelow, String(plan.final.lowest.closing))
ok('plan lowest cash >= buffer', plan.final.lowest.closing >= plan.final.buffer)
ok('plan costs less than borrowing the whole gap', plan.totalCost < plan.borrowAll.costPaise, `${plan.totalCost} vs ${plan.borrowAll.costPaise}`)
ok('every picked offer is cheaper than borrowing', plan.offers.every((o) => o.discountPaise < o.borrowCostPaise))
ok('discounts are whole rupees', plan.offers.every((o) => o.discountPaise % 100 === 0))
ok('net + discount = outstanding', plan.offers.every((o) => o.netPaise + o.discountPaise === o.outPaise))
ok('offers land before the gap starts', plan.offers.every((o) => o.payBy < plan.gapStart))
ok('overdraft is sized in Rs 10,000 steps', !plan.overdraft || plan.overdraft.amountPaise % CONFIG.overdraftRoundPaise === 0)
ok('no offers to disputed invoices', plan.offerCandidates.every((o) => !db.inbox.some((i) => i.invoiceId === o.invoiceId && i.type === 'dispute' && i.status === 'open')))

// money helpers
ok('discountFor 1.5% of 2,33,804 -> whole rupees', discountFor(23380400, 150) === 350700, String(discountFor(23380400, 150)))
ok('interestFor 1,00,000 at 18% for 42 days', interestFor(10000000, 18, 42) === 207123, String(interestFor(10000000, 18, 42)))

// customer accepts an offer -> forecast uses discounted amount and promised date
const o = plan.offers[0]
const inv = db.invoices.find((i) => i.id === o.invoiceId)
const before = forecast(db, today)
inv.offer = { status: 'accepted', bp: o.bp, payBy: o.payBy, sentOn: today, discountPaise: o.discountPaise, netPaise: o.netPaise, promisedOn: addDays(today, 10) }
db.promises.push({ id: 'p', invoiceId: inv.id, until: addDays(today, 10), createdAt: today })
const after = forecast(db, today)
ok('accepted offer reduces the shortfall', after.shortfall < before.shortfall, `${before.shortfall} -> ${after.shortfall}`)
const landed = after.weeks.flatMap((w) => w.ins).find((x) => x.invoiceId === inv.id)
ok('forecast uses the discounted amount', landed?.amountPaise === o.netPaise, JSON.stringify(landed))
ok('forecast uses the promised date', landed?.date === addDays(today, 10))
const replan = buildRescue(db, today)
ok('accepted invoice no longer offered again', !replan.offerCandidates.some((c) => c.invoiceId === inv.id))

// bank payment of exactly the discounted amount is recognised, and not mistaken for TDS
const net = o.netPaise
const rows = [{ date: addDays(today, 6), description: `NEFT/${inv.number}`, debitPaise: 0, creditPaise: net, reference: 'N-OFFER-1' }]
const [m] = matchRows(db, rows, today)
ok('discounted payment flagged early_discount', m.flags.includes('early_discount') && !m.flags.includes('possible_tds'), m.flags.join())
ok('allocates the net amount', m.allocations[0]?.amountPaise === net)
// too late (after payBy) -> ordinary part payment, not a discount
const [late] = matchRows(db, [{ ...rows[0], date: addDays(o.payBy, 3), reference: 'N-OFFER-2' }], today)
ok('payment after the offer expired is not treated as discount', !late.flags.includes('early_discount'))
// applying the discount settles the invoice exactly
const out0 = outstandingOf(db, inv)
ok('net + discount settles the invoice', out0 - net === inv.offer.discountPaise)

console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
