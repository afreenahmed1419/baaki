import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { makeSeedDb } from './data/index.js'
import { istToday } from './lib/dates.js'
import { financialYear } from './lib/dates.js'
import { nextInvoiceNumber } from './lib/gst.js'
import { isOpen, outstandingOf, invOf, ladderOf } from './lib/ledger.js'
import en from './i18n/en.js'
import hi from './i18n/hi.js'

const KEY = 'baaki.v1'
const DICTS = { en, hi }
const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw)
      if (db && db.invoices && db.business && db.settings && db.inbox && db.promises) return db
    }
  } catch { /* corrupt or blocked storage: fall back to the sample data */ }
  return makeSeedDb()
}

let uid = 0
const newId = (p) => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`

export function AppProvider({ children }) {
  const [db, setDb] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
  }, [db])

  // other tabs (e.g. the customer link page) write to the same storage
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY && e.newValue) {
        try { setDb(JSON.parse(e.newValue)) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const lang = db.settings.lang
  const today = db.settings.demoDate || istToday()

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
    document.documentElement.dataset.text = db.settings.textSize || 'normal'
  }, [lang, db.settings.textSize])

  const t = useCallback((key, vars) => {
    const s = DICTS[lang]?.[key] ?? en[key] ?? key
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s
  }, [lang])

  // run a mutation on a deep copy
  const mutate = useCallback((fn) => {
    setDb((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const actions = useMemo(() => ({
    reset: () => setDb(makeSeedDb()),
    setSettings: (patch) => mutate((d) => { Object.assign(d.settings, patch) }),
    setBusiness: (patch) => mutate((d) => { Object.assign(d.business, patch) }),
    setLadder: (ladder) => mutate((d) => { d.settings.ladder = ladder }),

    addCustomer: (c) => {
      const id = newId('c')
      mutate((d) => { d.customers.push({ history: [0, 0, 0, 0, 0, 0], lang: 'en', ...c, id }) })
      return id
    },
    updateCustomer: (id, patch) => mutate((d) => { Object.assign(d.customers.find((c) => c.id === id), patch) }),

    // Save an invoice; draft=true keeps it as a draft. Numbers are assigned once and never reused.
    saveInvoice: (draftInv, { send = false, channel = 'email' } = {}) => {
      const id = draftInv.id || newId('inv')
      mutate((d) => {
        const t0 = d.settings.demoDate || istToday()
        const existing = d.invoices.find((i) => i.id === id)
        if (existing) {
          Object.assign(existing, draftInv, { draft: !send && existing.draft })
        } else {
          const number = draftInv.number || nextInvoiceNumber(d.invoices.map((i) => i.number), financialYear(draftInv.issued))
          d.invoices.push({ creditNotePaise: 0, reverseCharge: false, token: 'tk' + Math.random().toString(36).slice(2, 8) + d.invoices.length, ...draftInv, id, number, draft: !send })
          d.events.push({ id: newId('ev'), invoiceId: id, customerId: draftInv.customerId, type: 'created', date: t0 })
        }
        const inv = d.invoices.find((i) => i.id === id)
        if (send) {
          inv.draft = false
          if (!d.events.some((e) => e.invoiceId === id && e.type === 'sent')) {
            d.events.push({ id: newId('ev'), invoiceId: id, customerId: inv.customerId, type: 'sent', date: t0, channel })
          }
        }
      })
      return id
    },
    sendDraft: (id, channel = 'email') => mutate((d) => {
      const inv = d.invoices.find((i) => i.id === id)
      inv.draft = false
      d.events.push({ id: newId('ev'), invoiceId: id, customerId: inv.customerId, type: 'sent', date: d.settings.demoDate || istToday(), channel })
    }),

    // Log that a ladder step was sent (one event per invoice in the group).
    markSent: (group, channel, text) => mutate((d) => {
      const t0 = d.settings.demoDate || istToday()
      for (const id of group.invoiceIds) {
        const inv = d.invoices.find((i) => i.id === id)
        const already = d.events.some((e) => e.invoiceId === id && e.stage === group.stage.id && ['reminder', 'letter', 'advice'].includes(e.type))
        if (already) continue
        const type = group.stage.kind === 'letter' ? 'letter' : group.stage.kind === 'advice' ? 'advice' : 'reminder'
        d.events.push({ id: newId('ev'), invoiceId: id, customerId: inv.customerId, type, stage: group.stage.id, date: t0, channel, text })
      }
    }),
    snooze: (group, days = 2) => mutate((d) => {
      const until = new Date(Date.parse((d.settings.demoDate || istToday()) + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
      for (const id of group.invoiceIds) d.snoozes[`${id}:${group.stage.id}`] = until
    }),
    promise: (invoiceIds, until, note) => mutate((d) => {
      const t0 = d.settings.demoDate || istToday()
      for (const id of invoiceIds) {
        d.promises.push({ id: newId('pr'), invoiceId: id, until, createdAt: t0 })
        d.events.push({ id: newId('ev'), invoiceId: id, customerId: d.invoices.find((i) => i.id === id).customerId, type: 'promise', date: t0, text: note || until })
      }
    }),
    cancelPromise: (id) => mutate((d) => { const p = d.promises.find((x) => x.id === id); if (p) p.cancelled = true }),

    addPayment: ({ invoiceId, amountPaise, date, ref, mode }) => mutate((d) => {
      const inv = d.invoices.find((i) => i.id === invoiceId)
      d.payments.push({ id: newId('pay'), invoiceId, customerId: inv.customerId, amountPaise, date, ref: ref || '', mode: mode || 'Manual' })
      d.events.push({ id: newId('ev'), invoiceId, customerId: inv.customerId, type: 'payment', date, amountPaise })
    }),

    // Customer link actions (no login). Both pause the ladder until the owner resolves them.
    submitCustomerNote: (token, kind, data) => {
      mutate((d) => {
        const inv = d.invoices.find((i) => i.token === token)
        if (!inv) return
        const t0 = d.settings.demoDate || istToday()
        d.inbox.push({ id: newId('ib'), type: kind === 'dispute' ? 'dispute' : 'paid_claim', invoiceId: inv.id, customerId: inv.customerId, createdAt: t0, status: 'open', ...data })
        d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: kind === 'dispute' ? 'dispute' : 'claim', date: t0, text: data.text || data.ref })
      })
    },
    // action: 'accept_paid' | 'credit_note' | 'reject' | 'edit'
    resolveInbox: (id, action, { reply, amountPaise } = {}) => mutate((d) => {
      const item = d.inbox.find((i) => i.id === id)
      const inv = d.invoices.find((i) => i.id === item.invoiceId)
      const t0 = d.settings.demoDate || istToday()
      item.status = action === 'reject' ? 'rejected' : 'accepted'
      item.reply = reply || ''
      item.resolvedAt = t0
      if (action === 'accept_paid') {
        const out = outstandingOf(d, inv)
        if (out > 0) {
          d.payments.push({ id: newId('pay'), invoiceId: inv.id, customerId: inv.customerId, amountPaise: out, date: item.paidOn || t0, ref: item.ref || 'claim', mode: 'Customer claim' })
        }
      }
      if (action === 'credit_note') {
        inv.creditNotePaise = (inv.creditNotePaise || 0) + (amountPaise || 0)
      }
      d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: 'resolved', date: t0, text: `${action}${reply ? ': ' + reply : ''}` })
    }),

    // Bank statement matches
    confirmMatch: (match, { settleTds = false, settleDiscount = false, unapplyExcess = true, manualInvoiceId = null } = {}) => mutate((d) => {
      const r = match.row
      const allocs = manualInvoiceId ? [{ invoiceId: manualInvoiceId, amountPaise: Math.min(r.creditPaise, outstandingOf(d, d.invoices.find((i) => i.id === manualInvoiceId))) }] : match.allocations
      let used = 0
      for (const a of allocs) {
        const inv = d.invoices.find((i) => i.id === a.invoiceId)
        d.payments.push({ id: newId('pay'), invoiceId: a.invoiceId, customerId: inv.customerId, amountPaise: a.amountPaise, date: r.date, ref: r.reference, mode: 'Bank' })
        d.events.push({ id: newId('ev'), invoiceId: a.invoiceId, customerId: inv.customerId, type: 'payment', date: r.date, amountPaise: a.amountPaise })
        used += a.amountPaise
        if (settleDiscount && match.flags.includes('early_discount') && inv.offer) {
          inv.creditNotePaise = (inv.creditNotePaise || 0) + inv.offer.discountPaise
          inv.offer.status = 'used'
          d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: 'note', date: r.date, text: 'Early-payment discount applied' })
        }
        if (settleTds && match.flags.includes('possible_tds')) {
          const short = outstandingOf(d, inv)
          if (short > 0) {
            d.payments.push({ id: newId('pay'), invoiceId: a.invoiceId, customerId: inv.customerId, amountPaise: short, date: r.date, ref: 'TDS (certificate awaited)', mode: 'TDS' })
            d.events.push({ id: newId('ev'), invoiceId: a.invoiceId, customerId: inv.customerId, type: 'note', date: r.date, text: 'TDS deducted by customer; certificate awaited' })
          }
        }
      }
      const left = r.creditPaise - used
      if (left > 0 && unapplyExcess) {
        d.unapplied.push({ id: newId('un'), customerId: match.customerId, amountPaise: left, date: r.date, ref: r.reference, note: r.description })
      }
      d.importedKeys.push(match.key)
    }),
    // Early-payment offer (Cash Rescue Plan). c = offer candidate from rescue.js
    sendOffer: (c, channel, text) => mutate((d) => {
      const inv = d.invoices.find((i) => i.id === c.invoiceId)
      const t0 = d.settings.demoDate || istToday()
      inv.offer = { status: 'sent', bp: c.bp, payBy: c.payBy, sentOn: t0, discountPaise: c.discountPaise, netPaise: c.netPaise }
      d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: 'offer', date: t0, channel, amountPaise: c.discountPaise, text })
    }),
    withdrawOffer: (invoiceId) => mutate((d) => {
      const inv = d.invoices.find((i) => i.id === invoiceId)
      if (inv?.offer) inv.offer.status = 'withdrawn'
    }),
    // Customer link: accept (with the date they will pay) or decline an offer
    respondOffer: (token, accept, date) => mutate((d) => {
      const inv = d.invoices.find((i) => i.token === token)
      if (!inv?.offer || !['sent', 'accepted'].includes(inv.offer.status)) return
      const t0 = d.settings.demoDate || istToday()
      if (accept) {
        inv.offer.status = 'accepted'
        inv.offer.promisedOn = date
        d.promises.push({ id: newId('pr'), invoiceId: inv.id, until: date, createdAt: t0 })
        d.inbox.push({ id: newId('ib'), type: 'offer_accepted', invoiceId: inv.id, customerId: inv.customerId, createdAt: t0, status: 'open', promisedOn: date, text: String(date) })
        d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: 'offer_accepted', date: t0, text: date })
      } else {
        inv.offer.status = 'declined'
        d.events.push({ id: newId('ev'), invoiceId: inv.id, customerId: inv.customerId, type: 'offer_declined', date: t0 })
      }
    }),
    skipMatch: (match) => mutate((d) => { d.importedKeys.push(match.key) }),
  }), [mutate])

  const value = useMemo(() => ({ db, today, lang, t, ...actions }), [db, today, lang, t, actions])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { isOpen, invOf, ladderOf }
