// Derived numbers: statuses, ladder, priority, forecast. Pure functions of the db and "today".
import { CONFIG } from '../config.js'
import { calcInvoice, docTypeFor } from './gst.js'
import { addDays, addMonths, diffDays, dayOfMonth } from './dates.js'

export const custOf = (db, inv) => db.customers.find((c) => c.id === inv.customerId)
export const invOf = (db, id) => db.invoices.find((i) => i.id === id)

export function calcOf(db, inv) {
  return calcInvoice(inv.items, db.business, inv.placeStateCode)
}
export const totalOf = (db, inv) => calcOf(db, inv).total
export const paidOf = (db, inv) => db.payments.filter((p) => p.invoiceId === inv.id).reduce((a, p) => a + p.amountPaise, 0)
export const outstandingOf = (db, inv) => (inv.draft ? 0 : Math.max(0, totalOf(db, inv) - (inv.creditNotePaise || 0) - paidOf(db, inv)))
export const daysOverdue = (inv, today) => diffDays(today, inv.dueDate)

export const openInbox = (db, inv) => db.inbox.filter((i) => i.invoiceId === inv.id && i.status === 'open')
export const isDisputed = (db, inv) => openInbox(db, inv).some((i) => i.type === 'dispute')

// draft | paid | disputed | part_paid | overdue | due_soon | sent
export function statusOf(db, inv, today) {
  if (inv.draft) return 'draft'
  if (outstandingOf(db, inv) <= 0) return 'paid'
  if (isDisputed(db, inv)) return 'disputed'
  if (paidOf(db, inv) > 0) return 'part_paid'
  const od = daysOverdue(inv, today)
  if (od > 0) return 'overdue'
  if (od >= -CONFIG.dueSoonDays) return 'due_soon'
  return 'sent'
}

export const isOpen = (db, inv) => !inv.draft && outstandingOf(db, inv) > 0

// ---- customers -------------------------------------------------------------
export function customerStats(db, cust, today) {
  const delays = [...cust.history]
  for (const inv of db.invoices) {
    if (inv.customerId !== cust.id || inv.draft) continue
    const pays = db.payments.filter((p) => p.invoiceId === inv.id)
    if (outstandingOf(db, inv) <= 0 && pays.length) {
      const last = pays.reduce((a, p) => (p.date > a ? p.date : a), '0000')
      delays.push(diffDays(last, inv.dueDate))
    } else if (outstandingOf(db, inv) > 0 && daysOverdue(inv, today) > 0) {
      delays.push(daysOverdue(inv, today)) // still unpaid: at least this late
    }
  }
  const recent = delays.slice(-8)
  const avgLate = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
  const onTimePct = Math.round((recent.filter((d) => d <= 0).length / recent.length) * 100)
  const grade = avgLate <= 3 && onTimePct >= 60 ? 'A' : avgLate <= 14 ? 'B' : 'C'
  const owed = db.invoices.filter((i) => i.customerId === cust.id).reduce((a, i) => a + outstandingOf(db, i), 0)
  return { avgLate, onTimePct, grade, owed, samples: recent.length }
}

// ---- escalation ladder ------------------------------------------------------
export const ladderOf = (db) => db.settings.ladder || CONFIG.ladder

export function sentStageIds(db, inv) {
  return new Set(db.events.filter((e) => e.invoiceId === inv.id && ['reminder', 'letter', 'advice'].includes(e.type)).map((e) => e.stage))
}
export function activePromise(db, inv, today) {
  return db.promises.find((p) => p.invoiceId === inv.id && !p.cancelled && p.until >= today) || null
}
export function pauseReason(db, inv, today) {
  const ib = openInbox(db, inv)
  if (ib.some((i) => i.type === 'dispute')) return 'dispute'
  if (ib.some((i) => i.type === 'paid_claim')) return 'claim'
  if (activePromise(db, inv, today)) return 'promise'
  return null
}

// The one ladder step that is due now for this invoice (null if none / paused / already sent).
export function dueStageFor(db, inv, today) {
  if (!isOpen(db, inv) || pauseReason(db, inv, today)) return null
  const od = daysOverdue(inv, today)
  const applicable = ladderOf(db).filter((s) => s.offset <= od)
  const last = applicable[applicable.length - 1]
  if (!last) return null
  if (sentStageIds(db, inv).has(last.id)) return null
  const snoozed = db.snoozes?.[`${inv.id}:${last.id}`]
  if (snoozed && snoozed > today) return null
  return { stage: last, daysOverdue: od }
}

// Items for "Today's follow-ups": grouped by customer and step, so one message lists every invoice.
export function followUps(db, today) {
  const groups = new Map()
  for (const inv of db.invoices) {
    const d = dueStageFor(db, inv, today)
    if (!d) continue
    const key = `${inv.customerId}:${d.stage.id}`
    if (!groups.has(key)) groups.set(key, { key, customerId: inv.customerId, stage: d.stage, invoiceIds: [], maxOverdue: -999 })
    const g = groups.get(key)
    g.invoiceIds.push(inv.id)
    g.maxOverdue = Math.max(g.maxOverdue, d.daysOverdue)
  }
  const order = (g) => ladderOf(db).findIndex((s) => s.id === g.stage.id)
  return [...groups.values()].sort((a, b) => order(b) - order(a) || b.maxOverdue - a.maxOverdue)
}

export function nextStageFor(db, inv) {
  if (!isOpen(db, inv)) return null
  const sent = sentStageIds(db, inv)
  return ladderOf(db).find((s) => !sent.has(s.id) && s.offset > -999) || null
}

// ---- MSMED Act interest (informational) --------------------------------------
// Compound interest, monthly rests, at 3x the RBI bank rate, from the day after the agreed due date
// (the agreed period can't exceed 45 days from the invoice date).
export function msmeInterest(principalPaise, inv, today) {
  const start = [inv.dueDate, addDays(inv.issued, CONFIG.msmedMaxCreditDays)].sort()[0]
  const days = diffDays(today, start)
  if (days <= 0 || principalPaise <= 0) return { interestPaise: 0, days: Math.max(0, days), from: start }
  const annual = (CONFIG.rbiBankRatePct * CONFIG.msmedInterestMultiplier) / 100
  const monthly = annual / 12
  let months = 0
  while (addMonths(start, months + 1) <= today) months++
  const rest = diffDays(today, addMonths(start, months))
  const amount = principalPaise * Math.pow(1 + monthly, months) * (1 + (annual * rest) / 365)
  return { interestPaise: Math.round(amount - principalPaise), days, from: start, months, ratePct: annual * 100 }
}

// ---- cash forecast ------------------------------------------------------------
export const DOUBTFUL_AFTER_DAYS = 60

export function expectedDate(db, inv, today, opts = {}) {
  const cust = custOf(db, inv)
  const stats = customerStats(db, cust, today)
  const promise = activePromise(db, inv, today)
  let d = promise ? promise.until : addDays(inv.dueDate, Math.max(0, stats.avgLate))
  if (!promise && d <= today) {
    // already later than this customer's usual delay: the longer it has dragged on, the later we expect it
    const od = diffDays(today, inv.dueDate)
    d = addDays(today, Math.min(45, 7 + Math.round(od / 2) + (stats.grade === 'C' ? 7 : 0)))
  }
  if (opts.delayCustomerId === inv.customerId) d = addDays(d, 30)
  if (d < addDays(today, 2)) d = addDays(today, 2)
  return d
}

function expenseDates(x, from, to) {
  const out = []
  if (x.type === 'once') {
    if (x.date >= from && x.date <= to) out.push(x.date)
  } else {
    for (let m = 0; m < 5; m++) {
      const first = addMonths(from.slice(0, 8) + '01', m)
      const d = first.slice(0, 8) + String(x.day).padStart(2, '0')
      if (d >= from && d <= to) out.push(d)
    }
  }
  return out
}

export function forecast(db, today, opts = {}) {
  const N = CONFIG.forecastWeeks
  const end = addDays(today, N * 7 - 1)
  const weeks = Array.from({ length: N }, (_, i) => ({ index: i, start: addDays(today, i * 7), end: addDays(today, i * 7 + 6), ins: [], outs: [] }))
  const weekOf = (d) => Math.floor(diffDays(d, today) / 7)

  const doubtful = []
  for (const inv of db.invoices) {
    if (!isOpen(db, inv)) continue
    const out = outstandingOf(db, inv)
    const acc = opts.accelerate?.[inv.id]
    if (acc) {
      const aw = weekOf(acc.date)
      if (aw >= 0 && aw < N) weeks[aw].ins.push({ invoiceId: inv.id, amountPaise: acc.amountPaise, date: acc.date, label: inv.number })
      continue
    }
    // very late invoices are not assumed to arrive, unless the customer has committed by accepting an offer
    if (isDisputed(db, inv) || (daysOverdue(inv, today) > DOUBTFUL_AFTER_DAYS && inv.offer?.status !== 'accepted')) {
      doubtful.push({ invoiceId: inv.id, amountPaise: out, reason: isDisputed(db, inv) ? 'dispute' : 'very_late' })
      continue
    }
    const d = expectedDate(db, inv, today, opts)
    const w = weekOf(d)
    // a customer who accepted an early-payment offer pays the discounted amount
    const net = inv.offer?.status === 'accepted' ? out - Math.min(out, inv.offer.discountPaise) : out
    if (w >= 0 && w < N) weeks[w].ins.push({ invoiceId: inv.id, amountPaise: net, date: d, label: inv.number })
  }
  for (const x of opts.extraIns || []) {
    const xw = weekOf(x.date)
    if (xw >= 0 && xw < N) weeks[xw].ins.push({ amountPaise: x.amountPaise, date: x.date, label: x.label })
  }
  if (opts.bigOrder) {
    weeks[Math.min(6, N - 1)].ins.push({ amountPaise: 300000_00, date: weeks[6].start, label: 'bigOrder' })
    weeks[Math.min(3, N - 1)].outs.push({ amountPaise: 180000_00, date: weeks[3].start, label: 'bigOrderCost' })
  }
  for (const x of db.expenses) {
    for (let d of expenseDates(x, today, addDays(end, 40))) {
      if (opts.supplierDelay && x.kind === 'supplier') d = addDays(d, 14)
      if (d < today || d > end) continue
      weeks[weekOf(d)].outs.push({ expenseId: x.id, amountPaise: x.amountPaise, date: d, label: x.label })
    }
  }

  let cash = db.business.cashPaise
  for (const w of weeks) {
    w.opening = cash
    w.in = w.ins.reduce((a, b) => a + b.amountPaise, 0)
    w.out = w.outs.reduce((a, b) => a + b.amountPaise, 0)
    w.closing = w.opening + w.in - w.out
    cash = w.closing
  }
  const buffer = db.settings.bufferPaise ?? CONFIG.safetyBufferPaise
  const lowest = weeks.reduce((a, w) => (w.closing < a.closing ? w : a), weeks[0])
  const firstBelow = weeks.find((w) => w.closing < buffer) || null
  const shortfall = firstBelow ? buffer - lowest.closing : 0
  return { weeks, buffer, lowest, firstBelow, shortfall, doubtful, opening: db.business.cashPaise }
}

// Which invoices, if collected early, would close the gap.
export function coverGap(db, today, fc, opts = {}) {
  if (!fc.firstBelow) return { picks: [], covered: true, total: 0 }
  const gapWeek = fc.firstBelow.index
  const cands = []
  for (const inv of db.invoices) {
    if (!isOpen(db, inv)) continue
    const d = expectedDate(db, inv, today, opts)
    const w = Math.floor(diffDays(d, today) / 7)
    if (w > gapWeek || isDisputed(db, inv) || (daysOverdue(inv, today) > DOUBTFUL_AFTER_DAYS && inv.offer?.status !== 'accepted')) {
      cands.push({ inv, amountPaise: outstandingOf(db, inv), od: daysOverdue(inv, today), expected: d })
    }
  }
  // oldest and largest first
  cands.sort((a, b) => b.od - a.od || b.amountPaise - a.amountPaise)
  const picks = []
  let sum = 0
  for (const c of cands) {
    if (sum >= fc.shortfall) break
    picks.push(c)
    sum += c.amountPaise
  }
  return { picks, covered: sum >= fc.shortfall, total: sum, shortfall: fc.shortfall }
}

// ---- Chase these first ----------------------------------------------------------
export function priorityList(db, today, fc, opts = {}) {
  const gap = coverGap(db, today, fc, opts)
  const gapIds = new Set(gap.picks.map((p) => p.inv.id))
  const rows = []
  for (const inv of db.invoices) {
    if (!isOpen(db, inv)) continue
    const od = daysOverdue(inv, today)
    if (od <= 0) continue
    const out = outstandingOf(db, inv)
    const cust = custOf(db, inv)
    const st = customerStats(db, cust, today)
    const amountPts = Math.min(30, Math.round((30 * out) / 20000000)) // caps at Rs 2,00,000
    const agePts = Math.min(30, Math.round(od / 3))
    const riskPts = { A: 5, B: 10, C: 20 }[st.grade]
    const gapPts = gapIds.has(inv.id) ? 20 : 0
    let score = amountPts + agePts + riskPts + gapPts
    const reason = pauseReason(db, inv, today)
    if (reason) score = Math.round(score * 0.4)
    const week = gapIds.has(inv.id) && fc.firstBelow ? fc.firstBelow.index + 1 : null
    rows.push({ inv, cust, out, od, grade: st.grade, avgLate: st.avgLate, score: Math.min(100, score), coversGap: gapIds.has(inv.id), gapWeek: week, paused: reason })
  }
  return rows.sort((a, b) => b.score - a.score)
}

// ---- dashboard numbers -----------------------------------------------------------
export function summary(db, today) {
  const open = db.invoices.filter((i) => isOpen(db, i))
  const sum = (arr) => arr.reduce((a, i) => a + outstandingOf(db, i), 0)
  const overdue = open.filter((i) => daysOverdue(i, today) > 0)
  const buckets = { not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 }
  for (const i of open) {
    const od = daysOverdue(i, today)
    const k = od <= 0 ? 'not_due' : od <= 30 ? 'd1_30' : od <= 60 ? 'd31_60' : od <= 90 ? 'd61_90' : 'd90'
    buckets[k] += outstandingOf(db, i)
  }
  const inDays = (n) => open.filter((i) => !isDisputed(db, i) && expectedDate(db, i, today) <= addDays(today, n))
  const billsDue = db.expenses.reduce((a, x) => a + expenseDates(x, today, addDays(today, 30)).length * x.amountPaise, 0)
  return {
    toCollect: sum(open), overdue: sum(overdue), overdueCount: overdue.length, openCount: open.length,
    expectedWeek: sum(inDays(7)), expectedMonth: sum(inDays(30)), billsDue30: billsDue, buckets,
  }
}

export { docTypeFor, dayOfMonth }
