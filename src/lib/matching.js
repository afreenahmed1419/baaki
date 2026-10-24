// Match bank credits to invoices. Nothing is marked paid here: this only proposes matches.
import { CONFIG } from '../config.js'
import { parseRupees, roundDiv } from './money.js'
import { calcOf, custOf, isOpen, outstandingOf } from './ledger.js'
import { diffDays } from './dates.js'

export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  const split = (line) => {
    const out = []
    let cur = '', q = false
    for (const ch of line) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const head = split(lines[0]).map((h) => h.toLowerCase())
  const col = (name) => head.findIndex((h) => h.includes(name))
  const iDate = col('date'), iDesc = col('desc'), iDeb = col('debit'), iCr = col('credit'), iRef = col('ref')
  return lines.slice(1).map((l) => {
    const c = split(l)
    return {
      date: c[iDate], description: c[iDesc] || '',
      debitPaise: parseRupees(c[iDeb]) || 0, creditPaise: parseRupees(c[iCr]) || 0, reference: c[iRef] || '',
    }
  })
}

export const rowKey = (r) => `${r.date}|${r.creditPaise}|${r.reference}`

const NOISE = /\b(m\/s|ms|pvt|private|ltd|limited|llp|co|company|and|&)\b/g
const norm = (s) => s.toLowerCase().replace(NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

function findCustomer(db, desc) {
  const d = ' ' + norm(desc) + ' '
  let best = null
  for (const c of db.customers) {
    const toks = norm(c.name).split(' ').filter((t) => t.length > 2)
    if (!toks.length) continue
    const hit = toks.filter((t) => d.includes(' ' + t) || d.includes(t)).length
    const score = hit / toks.length
    if (score >= 0.5 && (!best || score > best.score)) best = { cust: c, score }
  }
  return best
}

// Invoice numbers named in the text: "INV/26-27/0012", "INV 26-27 12", "INV 26-27 0009 0011", "0012".
function findInvoiceSeqs(desc) {
  const up = desc.toUpperCase()
  const seqs = []
  const m = up.match(/INV[^0-9]*(\d{2})[^0-9]+(\d{2})[^0-9]+(\d{1,4})((?:[^0-9A-Z]+\d{1,4})*)/)
  if (m) {
    seqs.push(parseInt(m[3], 10))
    const rest = (m[4] || '').match(/\d{1,4}/g) || []
    for (const r of rest) seqs.push(parseInt(r, 10))
  }
  return { seqs, fy: m ? `${m[1]}-${m[2]}` : null }
}

function seqOf(inv) {
  return parseInt(inv.number.split('/').pop(), 10)
}

export function matchRows(db, rows, today) {
  const seen = new Set(db.importedKeys || [])
  const results = []
  for (const r of rows) {
    if (!r.creditPaise) continue
    const key = rowKey(r)
    const base = { id: 'm' + results.length, row: r, key, allocations: [], excessPaise: 0, flags: [], reasons: [], confidence: 0, customerId: null, status: 'pending' }
    if (seen.has(key)) { results.push({ ...base, status: 'duplicate', flags: ['duplicate'], reasons: ['already_imported'] }); continue }

    const custHit = findCustomer(db, r.description)
    const { seqs, fy } = findInvoiceSeqs(r.description)
    let named = []
    for (const s of seqs) {
      const inv = db.invoices.find((i) => !i.draft && seqOf(i) === s && (!fy || i.number.includes(`/${fy}/`)))
      if (inv) named.push(inv)
    }
    if (custHit) named = named.filter((i) => i.customerId === custHit.cust.id || !custHit.cust)
    let cust = custHit?.cust || (named[0] ? custOf(db, named[0]) : null)
    base.customerId = cust?.id || null

    let candidates = named.filter((i) => outstandingOf(db, i) > 0)
    let how = 'number'
    if (!candidates.length && cust) {
      candidates = db.invoices.filter((i) => i.customerId === cust.id && isOpen(db, i)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
      how = 'name'
    }
    if (!candidates.length) {
      results.push({ ...base, flags: ['unmatched'], reasons: [cust ? 'no_open_invoice' : 'nothing_found'], confidence: 0 })
      continue
    }

    // Exact fit on one invoice, or on the whole named set?
    let remaining = r.creditPaise
    const allocations = []
    const sumNamed = candidates.reduce((a, i) => a + outstandingOf(db, i), 0)
    const flags = []
    const reasons = []

    if (candidates.length > 1 && how === 'number' && remaining === sumNamed) {
      for (const i of candidates) allocations.push({ invoiceId: i.id, amountPaise: outstandingOf(db, i) })
      remaining = 0
      flags.push('multi_invoice'); reasons.push('covers_several')
    } else if (how === 'name' && candidates.length > 1) {
      // Prefer one open invoice whose amount equals the payment; otherwise oldest first
      const exact = candidates.find((i) => outstandingOf(db, i) === remaining)
      const pool = exact ? [exact] : candidates
      for (const i of pool) {
        if (remaining <= 0) break
        const take = Math.min(remaining, outstandingOf(db, i))
        allocations.push({ invoiceId: i.id, amountPaise: take })
        remaining -= take
      }
      if (allocations.length > 1) flags.push('multi_invoice')
    } else {
      for (const i of candidates) {
        if (remaining <= 0) break
        const take = Math.min(remaining, outstandingOf(db, i))
        allocations.push({ invoiceId: i.id, amountPaise: take })
        remaining -= take
      }
      if (allocations.length > 1) flags.push('multi_invoice')
    }

    const first = db.invoices.find((i) => i.id === allocations[0].invoiceId)
    const firstOut = outstandingOf(db, first)
    const exactOne = allocations.length === 1 && allocations[0].amountPaise === firstOut && remaining === 0
    if (remaining > 0) { flags.push('overpayment'); reasons.push('more_than_due') }
    if (allocations.length === 1 && allocations[0].amountPaise < firstOut && remaining === 0) {
      const short = firstOut - allocations[0].amountPaise
      const taxable = calcOf(db, first).taxable
      const pct = CONFIG.tdsPercents.find((p) => roundDiv(taxable * p, 100) === short)
      const offer = first.offer
      if (offer && ['sent', 'accepted'].includes(offer.status) && short === offer.discountPaise && r.date <= offer.payBy) {
        flags.push('early_discount'); reasons.push('discount_offer')
      } else if (pct) { flags.push('possible_tds'); reasons.push(`tds_${pct}`) }
      else { flags.push('part_payment'); reasons.push('less_than_due') }
    }
    if (exactOne) reasons.push('amount_exact')
    reasons.unshift(how === 'number' ? 'invoice_number_found' : 'customer_name_found')

    let confidence = how === 'number' ? 0.9 : 0.65
    if (exactOne || flags.includes('multi_invoice') && remaining === 0 && !flags.includes('part_payment')) confidence += 0.08
    if (flags.includes('possible_tds')) confidence = 0.8
    if (flags.includes('overpayment')) confidence -= 0.1
    results.push({ ...base, customerId: cust?.id || null, allocations, excessPaise: remaining, flags, reasons, confidence: Math.max(0.3, Math.min(0.99, confidence)) })
  }
  void today; void diffDays
  return results
}
