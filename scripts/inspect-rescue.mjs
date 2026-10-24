import { makeSeedDb } from '../src/data/index.js'
import { CONFIG } from '../src/config.js'
import { buildRescue } from '../src/lib/rescue.js'
import { inr } from '../src/lib/money.js'

const db = makeSeedDb()
const r = buildRescue(db, CONFIG.demoToday)
console.log('shortfall', inr(r.base.shortfall), 'first below wk', r.base.firstBelow.index + 1)
console.log('supplier', r.supplier && { gain: inr(r.supplier.gainPaise), cost: inr(r.supplier.costPaise) })
console.table(r.offerCandidates.map((c) => ({ inv: c.invoiceId, cust: r.custName(c.invoiceId).slice(0, 16), out: inr(c.outPaise), disc: inr(c.discountPaise), net: inr(c.netPaise), bp: c.bp, payBy: c.payBy, early: c.daysEarlier, borrowDays: c.borrowDays, custYield: c.customerYieldPct + '%', borrow: inr(c.borrowCostPaise), ok: c.cheaperThanBorrowing })))
console.log('picked', r.offers.length, 'discount total', inr(r.discountTotal))
console.log('overdraft', r.overdraft && { amt: inr(r.overdraft.amountPaise), cost: inr(r.overdraft.costPaise), days: r.overdraft.days })
console.log('total cost', inr(r.totalCost), 'borrow-all', inr(r.borrowAll.costPaise), 'savings', inr(r.savingsPaise), 'closed', r.closed)
console.log('final lowest', inr(r.final.lowest.closing), 'buffer', inr(r.final.buffer))
