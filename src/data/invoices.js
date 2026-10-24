import { CONFIG } from '../config.js'
import { business } from './business.js'
import { customers } from './customers.js'
import { addDays, diffDays, financialYear } from '../lib/dates.js'
import { calcInvoice } from '../lib/gst.js'

// 40 made-up invoices over about 4 months, built from compact rows so the totals stay exact.
const TODAY = CONFIG.demoToday

export const CATALOG = {
  box5: { description: '5-ply corrugated carton 12x10x8 in', hsn: '4819', unit: 'pcs', ratePaise: 4200, gstRate: 5 },
  box3: { description: '3-ply corrugated carton 9x6x6 in', hsn: '4819', unit: 'pcs', ratePaise: 2800, gstRate: 5 },
  pizza: { description: 'Pizza box 10 in, kraft', hsn: '4819', unit: 'pcs', ratePaise: 1800, gstRate: 5 },
  printed: { description: 'Printed carton, 2-colour, 14x10x10 in', hsn: '4819', unit: 'pcs', ratePaise: 5500, gstRate: 5 },
  tape: { description: 'BOPP packing tape 48mm x 100m', hsn: '3919', unit: 'roll', ratePaise: 9500, gstRate: 18 },
  wrap: { description: 'Stretch wrap film 500mm', hsn: '3920', unit: 'roll', ratePaise: 32000, gstRate: 18 },
  design: { description: 'Packaging design and die-making', hsn: '998391', unit: 'job', ratePaise: 1200000, gstRate: 18 },
}

// out: paid | open | part | draft | disputed. key marks invoices used by the sample bank statement.
// due: true = the latest ladder step is waiting to be sent today.
const ROWS = [
  { c: 'c1', ago: 88, out: 'paid', items: [['box5', 1500]] },
  { c: 'c1', ago: 58, out: 'paid', items: [['printed', 1200], ['tape', 20]] },
  { c: 'c1', ago: 27, out: 'open', key: 'exact', due: true, items: [['box5', 2400], ['tape', 30]] },
  { c: 'c1', ago: 12, out: 'open', items: [['pizza', 3000]] },

  { c: 'c2', ago: 75, out: 'paid', items: [['box3', 4000]] },
  { c: 'c2', ago: 12, out: 'open', items: [['box5', 1800]] },
  { c: 'c2', ago: 0, out: 'draft', items: [['box3', 2500]] },

  { c: 'c3', ago: 115, out: 'paid', items: [['box5', 3000]] },
  { c: 'c3', ago: 85, out: 'paid', items: [['printed', 1800]] },
  { c: 'c3', ago: 52, out: 'open', key: 'part', items: [['printed', 3500], ['wrap', 40]] },
  { c: 'c3', ago: 24, out: 'open', items: [['box5', 2000]] },

  { c: 'c4', ago: 105, out: 'paid', items: [['box3', 5000]] },
  { c: 'c4', ago: 70, out: 'paid', items: [['box5', 1200]] },
  { c: 'c4', ago: 47, out: 'open', key: 'tds', items: [['box5', 3200]] },

  { c: 'c5', ago: 100, out: 'paid', items: [['pizza', 6000]] },
  { c: 'c5', ago: 78, out: 'open', key: 'multi1', due: true, items: [['pizza', 8000], ['tape', 25]] },
  { c: 'c5', ago: 66, out: 'open', key: 'multi2', due: true, items: [['box3', 5500]] },

  { c: 'c6', ago: 112, out: 'paid', items: [['printed', 2500]] },
  { c: 'c6', ago: 80, out: 'paid', items: [['box5', 2200]] },
  { c: 'c6', ago: 33, out: 'open', key: 'over', items: [['box5', 2600], ['design', 1]] },

  { c: 'c7', ago: 90, out: 'paid', items: [['box3', 1500]] },
  { c: 'c7', ago: 60, out: 'paid', items: [['pizza', 2000]] },
  { c: 'c7', ago: 40, out: 'open', due: true, items: [['box3', 2800]] },
  { c: 'c7', ago: 10, out: 'open', items: [['pizza', 1500]] },

  { c: 'c8', ago: 108, out: 'paid', items: [['box3', 7000]] },
  { c: 'c8', ago: 74, out: 'paid', items: [['printed', 2600]] },
  { c: 'c8', ago: 95, out: 'open', items: [['box3', 9000]] },
  { c: 'c8', ago: 57, out: 'disputed', key: 'dispute', items: [['box5', 4000]] },

  { c: 'c9', ago: 50, out: 'part', frac: 0.4, items: [['printed', 4500]] },
  { c: 'c9', ago: 20, out: 'open', items: [['box5', 3800]] },

  { c: 'c10', ago: 65, out: 'paid', items: [['pizza', 2200]] },
  { c: 'c10', ago: 35, out: 'paid', items: [['box3', 1800]] },
  { c: 'c10', ago: 31, out: 'open', key: 'claim', items: [['box5', 1700]] },

  { c: 'c11', ago: 60, out: 'paid', items: [['printed', 1400]] },
  { c: 'c11', ago: 30, out: 'paid', items: [['box5', 1600]] },
  { c: 'c11', ago: 14, out: 'open', items: [['printed', 2100]] },

  { c: 'c12', ago: 121, out: 'open', items: [['box5', 5200], ['tape', 40]] },
  { c: 'c12', ago: 101, out: 'paid', items: [['pizza', 5000]] },
  { c: 'c12', ago: 70, out: 'paid', items: [['box3', 4200]] },
  { c: 'c12', ago: 41, out: 'open', due: true, items: [['pizza', 6000]] },
]

const avgLate = (c) => Math.round(c.history.reduce((a, b) => a + b, 0) / c.history.length)
const custById = Object.fromEntries(customers.map((c) => [c.id, c]))

function build() {
  const rows = ROWS.map((r, i) => ({ ...r, issued: addDays(TODAY, -r.ago), order: i }))
  rows.sort((a, b) => (a.issued < b.issued ? -1 : a.issued > b.issued ? 1 : a.order - b.order))

  const invoices = []
  const payments = []
  const events = []
  let n = 0
  const ev = (e) => events.push({ id: `ev${events.length + 1}`, ...e })

  for (const r of rows) {
    n++
    const cust = custById[r.c]
    const id = `inv${String(n).padStart(3, '0')}`
    const number = `INV/${financialYear(r.issued)}/${String(n).padStart(4, '0')}`
    const dueDate = addDays(r.issued, cust.creditDays)
    const items = r.items.map(([k, qty]) => ({ ...CATALOG[k], qty, discountPct: 0 }))
    const inv = {
      id, number, customerId: cust.id, placeStateCode: cust.stateCode, issued: r.issued, dueDate,
      items, draft: r.out === 'draft', creditNotePaise: 0, reverseCharge: false,
      token: `t${(n * 7919 + 40961).toString(36)}${n}`,
      key: r.key || null,
    }
    invoices.push(inv)
    const total = calcInvoice(items, business, cust.stateCode).total

    ev({ invoiceId: id, customerId: cust.id, type: 'created', date: r.issued })
    if (r.out === 'draft') continue
    ev({ invoiceId: id, customerId: cust.id, type: 'sent', date: r.issued, channel: 'email' })

    if (r.out === 'paid') {
      const date = addDays(dueDate, avgLate(cust))
      payments.push({ id: `pay${payments.length + 1}`, invoiceId: id, customerId: cust.id, amountPaise: total, date: date > TODAY ? TODAY : date, ref: `NEFT-${10000 + n * 37}`, mode: 'NEFT' })
      ev({ invoiceId: id, customerId: cust.id, type: 'payment', date: date > TODAY ? TODAY : date, amountPaise: total })
      continue
    }
    if (r.out === 'part') {
      const part = Math.round((total * r.frac) / 100) * 100
      const date = addDays(dueDate, -10)
      payments.push({ id: `pay${payments.length + 1}`, invoiceId: id, customerId: cust.id, amountPaise: part, date, ref: `NEFT-${20000 + n * 41}`, mode: 'NEFT' })
      ev({ invoiceId: id, customerId: cust.id, type: 'payment', date, amountPaise: part })
    }
    // earlier ladder steps were already sent
    const overdue = diffDays(TODAY, dueDate)
    const applicable = CONFIG.ladder.filter((s) => s.offset <= overdue)
    applicable.forEach((s, i) => {
      if (r.due && i === applicable.length - 1) return
      const date = addDays(dueDate, s.offset)
      if (s.kind === 'advice') ev({ invoiceId: id, customerId: cust.id, type: 'advice', stage: s.id, date })
      else if (s.kind === 'letter') ev({ invoiceId: id, customerId: cust.id, type: 'letter', stage: s.id, date, channel: 'whatsapp' })
      else ev({ invoiceId: id, customerId: cust.id, type: 'reminder', stage: s.id, date, channel: 'whatsapp' })
    })
  }

  const byKey = Object.fromEntries(invoices.filter((i) => i.key).map((i) => [i.key, i]))
  const inbox = [
    {
      id: 'ib1', type: 'dispute', invoiceId: byKey.dispute.id, customerId: 'c8', createdAt: addDays(TODAY, -6), status: 'open',
      text: 'We received only 3,200 cartons, but the invoice says 4,000. Please check the delivery challan.',
    },
    {
      id: 'ib2', type: 'paid_claim', invoiceId: byKey.claim.id, customerId: 'c10', createdAt: addDays(TODAY, -1), status: 'open',
      ref: 'UTR 604388120512', paidOn: addDays(TODAY, -2), text: 'Paid by NEFT on the due date. Sending the screenshot on WhatsApp.',
    },
  ]
  events.push({ id: `ev${events.length + 1}`, invoiceId: byKey.dispute.id, customerId: 'c8', type: 'dispute', date: addDays(TODAY, -6), text: inbox[0].text })
  events.push({ id: `ev${events.length + 1}`, invoiceId: byKey.claim.id, customerId: 'c10', type: 'claim', date: addDays(TODAY, -1), text: `${inbox[1].ref}: ${inbox[1].text}` })

  return { invoices, payments, events, inbox }
}

export const seed = build()
export const invoices = seed.invoices
export const payments = seed.payments
export const events = seed.events
export const inbox = seed.inbox
