// Cash Rescue Plan: the cheapest way to close a forecast cash gap, tested against the real forecast.
// Levers, cheapest first: ask a supplier for more time, offer early-payment discounts to customers
// whose money would arrive after the gap, and borrow only what is left. All money is whole paise.
import { CONFIG } from '../config.js'
import { addDays, diffDays } from './dates.js'
import { roundDiv } from './money.js'
import { custOf, expectedDate, forecast, isDisputed, isOpen, outstandingOf, DOUBTFUL_AFTER_DAYS, daysOverdue, activePromise } from './ledger.js'

const ceilTo = (n, step) => Math.ceil(n / step) * step

// Discounts are whole rupees, as a real offer would be. bp = basis points (150 = 1.5%).
export const discountFor = (outPaise, bp) => roundDiv(outPaise * bp, 1_000_000) * 100

// Interest on  for  at  a year (simple interest), rounded to the paisa.
export const interestFor = (paise, aprPct, days) => Math.round((paise * aprPct * days) / (100 * 365))

// Try the most generous discount first (best for the customer) and keep the largest one that still
// costs clearly less than borrowing the same money for the same days.
const BP_STEPS = [250, 200, 150, 100]
const KEEP_MARGIN = 0.9

// A candidate offer for one invoice, or null if it would not help the gap.
export function offerCandidate(db, inv, today, fc, forcedBp) {
  if (!isOpen(db, inv) || isDisputed(db, inv)) return null
  if (inv.offer?.status === 'accepted') return null
  const out = outstandingOf(db, inv)
  const veryLate = daysOverdue(inv, today) > DOUBTFUL_AFTER_DAYS
  const promise = activePromise(db, inv, today)
  // where the forecast expects this money (very late invoices are not in the forecast: assume ~90 days)
  const expected = veryLate ? addDays(today, 90) : expectedDate(db, inv, today)
  const gapStart = fc.firstBelow.start
  if (expected <= gapStart && !veryLate) return null // arrives before the gap: nothing to fix
  // land the money just before the gap, not weeks early: a discount is a fixed % however early they pay
  const latest = addDays(gapStart, -3)
  const earliest = addDays(today, CONFIG.offerWindowDays)
  const payBy = latest > earliest ? latest : earliest
  const daysEarlier = diffDays(expected, payBy) // how much sooner the customer pays
  if (daysEarlier < CONFIG.offerMinDaysEarlier) return null
  const borrowDays = diffDays(expected, gapStart > payBy ? gapStart : payBy) // days we would otherwise borrow
  let chosen = null
  for (const bp of forcedBp ? [forcedBp] : BP_STEPS) {
    const discount = discountFor(out, bp)
    const net = out - discount
    const borrowCost = interestFor(net, CONFIG.overdraftAprPct, borrowDays)
    chosen = { bp, discount, net, borrowCost }
    if (discount <= borrowCost * KEEP_MARGIN) break
  }
  const { bp, discount, net, borrowCost } = chosen
  return {
    invoiceId: inv.id, customerId: inv.customerId, bp, payBy, expected, daysEarlier, borrowDays, veryLate, promised: !!promise,
    outPaise: out, discountPaise: discount, netPaise: net, borrowCostPaise: borrowCost,
    // what the customer earns, as a yearly rate, for paying early
    customerYieldPct: Math.round((discount / net) * (365 / daysEarlier) * 1000) / 10,
    cheaperThanBorrowing: discount <= borrowCost * KEEP_MARGIN,
    saveVsBorrowPaise: borrowCost - discount,
  }
}

export function buildRescue(db, today) {
  const base = forecast(db, today)
  if (!base.firstBelow) return { needed: false, base }

  const end = addDays(today, CONFIG.forecastWeeks * 7 - 1)
  const gapStart = base.firstBelow.start
  const gapDays = diffDays(end, gapStart) + 1

  // Lever 1: ask suppliers for 14 more days
  const fcSup = forecast(db, today, { supplierDelay: true })
  const supGain = base.shortfall - fcSup.shortfall
  const supBills = db.expenses.filter((x) => x.kind === 'supplier' && x.type === 'once' && x.date >= today && x.date <= end)
  const supCost = Math.round(supBills.reduce((a, x) => a + x.amountPaise, 0) * CONFIG.supplierDelayFeePctPerMonth * CONFIG.supplierDelayDays / (100 * 30))
  const useSupplier = supGain > 0

  // Lever 2: early-payment offers, cheapest cash first, only if cheaper than borrowing
  const cands = db.invoices.map((inv) => offerCandidate(db, inv, today, base)).filter(Boolean)
  const good = cands.filter((c) => c.cheaperThanBorrowing).sort((a, b) => a.discountPaise / a.netPaise - b.discountPaise / b.netPaise)
  let need = useSupplier ? fcSup.shortfall : base.shortfall
  const picked = []
  for (const c of good) {
    if (need <= 0) break
    picked.push(c)
    need -= c.netPaise
  }

  const accelerate = Object.fromEntries(picked.map((c) => [c.invoiceId, { date: c.payBy, amountPaise: c.netPaise }]))
  const stage1 = forecast(db, today, { supplierDelay: useSupplier, accelerate })

  // Lever 3: borrow only what is left, rounded up
  let overdraft = null
  let extraIns = []
  if (stage1.firstBelow) {
    const amount = ceilTo(stage1.shortfall, CONFIG.overdraftRoundPaise)
    overdraft = { amountPaise: amount, days: gapDays, costPaise: interestFor(amount, CONFIG.overdraftAprPct, gapDays), from: gapStart }
    extraIns = [{ date: gapStart, amountPaise: amount, label: 'overdraft' }]
  }
  const final = forecast(db, today, { supplierDelay: useSupplier, accelerate, extraIns })

  const discountTotal = picked.reduce((a, c) => a + c.discountPaise, 0)
  const totalCost = (useSupplier ? supCost : 0) + discountTotal + (overdraft?.costPaise || 0)
  const borrowAllAmount = ceilTo(base.shortfall, CONFIG.overdraftRoundPaise)
  const borrowAllCost = interestFor(borrowAllAmount, CONFIG.overdraftAprPct, gapDays)

  return {
    needed: true, base, final, gapStart, gapDays,
    supplier: useSupplier ? { gainPaise: supGain, costPaise: supCost, days: CONFIG.supplierDelayDays, bills: supBills.length } : null,
    offers: picked, offerCandidates: cands,
    overdraft, totalCost, discountTotal,
    borrowAll: { amountPaise: borrowAllAmount, costPaise: borrowAllCost },
    savingsPaise: borrowAllCost - totalCost,
    closed: !final.firstBelow,
    custName: (invoiceId) => custOf(db, db.invoices.find((i) => i.id === invoiceId)).name,
  }
}
