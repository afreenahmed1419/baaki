import { TEMPLATES, SUBJECTS } from '../data/templates.js'
import { CONFIG } from '../config.js'
import { custOf, invOf, outstandingOf } from './ledger.js'
import { inr } from './money.js'
import { addDays, diffDays, fmtDate } from './dates.js'

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? `{${k}}`))

export const payLink = (inv) => `${window.location.origin}/pay/${inv.token}`

// Build the ready-to-send message for one follow-up group (same customer, same ladder step).
export function buildMessage(db, group, lang, today) {
  const invs = group.invoiceIds.map((id) => invOf(db, id)).filter(Boolean)
  const cust = custOf(db, invs[0])
  const stage = group.stage.id
  const total = invs.reduce((a, i) => a + outstandingOf(db, i), 0)
  const days = Math.max(...invs.map((i) => diffDays(today, i.dueDate)))
  const earliestDue = invs.map((i) => i.dueDate).sort()[0]
  const vars = {
    contact: cust.contact, business: db.business.name, owner: db.business.owner, phone: db.business.phone,
    invoices: invs.map((i) => i.number).join(', '), amount: inr(total), due: fmtDate(earliestDue), days: String(days),
    link: payLink(invs[0]), deadline: fmtDate(addDays(today, CONFIG.demandDeadlineDays)),
  }
  const tpl = (TEMPLATES[lang] || TEMPLATES.en)[stage]
  const sub = (SUBJECTS[lang] || SUBJECTS.en)[stage]
  return { text: tpl ? fill(tpl, vars) : '', subject: sub ? fill(sub, vars) : '', cust, invs, total }
}

const digits = (s) => String(s || '').replace(/\D/g, '')
export const channelHref = {
  whatsapp: (cust, text) => `https://wa.me/${digits(cust.phone)}?text=${encodeURIComponent(text)}`,
  email: (cust, text, subject) => `mailto:${cust.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  sms: (cust, text) => `sms:${digits(cust.phone)}?&body=${encodeURIComponent(text)}`,
}

// Message for an early-payment offer (see rescue.js). c = an offer candidate.
export function buildOfferMessage(db, c, lang) {
  const inv = invOf(db, c.invoiceId)
  const cust = custOf(db, inv)
  const pct = (c.bp / 100).toString().replace(/\.0+$/, '') + '%'
  const vars = {
    contact: cust.contact, business: db.business.name, owner: db.business.owner, phone: db.business.phone,
    invoices: inv.number, amount: inr(c.outPaise), net: inr(c.netPaise), discount: inr(c.discountPaise), pct, payBy: fmtDate(c.payBy), link: payLink(inv),
  }
  return {
    text: fill((TEMPLATES[lang] || TEMPLATES.en).offer, vars),
    subject: fill((SUBJECTS[lang] || SUBJECTS.en).offer, vars),
    cust, inv,
  }
}
