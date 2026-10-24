import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import en from '../i18n/en.js'
import hi from '../i18n/hi.js'
import { calcOf, custOf, daysOverdue, isDisputed, isOpen, openInbox, outstandingOf } from '../lib/ledger.js'
import { addDays, fmtDate } from '../lib/dates.js'
import { inr, inr2 } from '../lib/money.js'
import { Qr, upiLink } from '../components/ui.jsx'

// What the customer sees. No login. Works from the unique link only.
export default function PayPage() {
  const { token } = useParams()
  const { db, today, submitCustomerNote, respondOffer } = useApp()
  const inv = db.invoices.find((i) => i.token === token && !i.draft)
  const cust = inv ? custOf(db, inv) : null
  const [lang, setLang] = useState(cust?.lang || 'en')
  const [mode, setMode] = useState(null) // 'paid' | 'wrong' | 'upi'
  const [done, setDone] = useState(null)
  const [ref, setRef] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [offerDate, setOfferDate] = useState('')
  const dict = lang === 'hi' ? hi : en
  const t = (k, v) => (dict[k] ?? en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v?.[x] ?? `{${x}}`)

  if (!inv) {
    return <main className="p-6 max-w-lg mx-auto"><h1>{t('pay.notFound')}</h1><p>{t('pay.notFoundBody')}</p></main>
  }
  const b = db.business
  const out = outstandingOf(db, inv)
  const calc = calcOf(db, inv)
  const od = daysOverdue(inv, today)
  const pending = openInbox(db, inv)
  const offer = inv.offer && ['sent', 'accepted'].includes(inv.offer.status) && today <= inv.offer.payBy ? inv.offer : null
  const payAmt = offer ? Math.min(out, offer.netPaise) : out
  const dateCap = offer?.payBy
  const pickDate = offerDate || (offer ? (addDays(today, 3) > offer.payBy ? offer.payBy : addDays(today, 3)) : '')
  const pctText = offer ? `${(offer.bp / 100).toString().replace(/.0+$/, '')}%` : ''
  const acceptOffer = () => {
    if (!pickDate || pickDate < today || pickDate > dateCap) return setErr(t('pay.offerErr', { payBy: fmtDate(dateCap) }))
    respondOffer(token, true, pickDate); setErr('')
  }
  const others = db.invoices.filter((i) => i.customerId === inv.customerId && i.id !== inv.id && !i.draft && isOpen(db, i))

  const submit = (kind) => {
    if (kind === 'paid' && !ref.trim()) return setErr(t('pay.errRef'))
    if (kind === 'dispute' && text.trim().length < 5) return setErr(t('pay.errReason'))
    submitCustomerNote(token, kind, kind === 'paid' ? { ref: ref.trim(), paidOn, text } : { text: text.trim() })
    setDone(kind); setErr('')
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-xl mx-auto p-4">
        <div className="flex justify-between items-center mb-3">
          <div><div className="text-xl font-extrabold text-[var(--brand)]">{b.name}</div><div className="hint">{b.address}</div></div>
          <div role="group" aria-label="Language" className="flex border-2 border-[var(--brand)] overflow-hidden shrink-0">
            {[['en', 'English'], ['hi', 'हिंदी']].map(([c, n]) => (
              <button key={c} aria-pressed={lang === c} onClick={() => setLang(c)} className={`min-h-[44px] px-3 font-bold ${lang === c ? 'bg-[var(--brand)] text-white' : 'bg-white text-[var(--brand)]'}`}>{n}</button>
            ))}
          </div>
        </div>

        <section className="card mb-3">
          <p className="m-0 hint">{t('pay.hello', { name: cust.contact })}</p>
          <h1 className="text-xl font-bold mt-1 mb-2">{t('pay.invoice')} {inv.number}</h1>
          {out > 0 ? (
            <>
              <div className="hint">{t('pay.amountDue')}</div>
              <div className="text-4xl font-extrabold money">{inr(out)}</div>
              <div className={od > 0 ? 'err' : 'hint'}>{od > 0 ? t('chase.overdueDays', { n: od }) : t('pay.dueOn', { date: fmtDate(inv.dueDate) })}</div>
            </>
          ) : <div className="badge ok text-lg">{t('status.paid')}</div>}
          <table className="stack-table mt-3" aria-label={t('pay.items')}>
            <thead><tr><th>{t('doc.description')}</th><th>{t('doc.qty')}</th><th>{t('doc.lineTotal')}</th></tr></thead>
            <tbody>{calc.lines.map((l, i) => <tr key={i}><td data-label={t('doc.description')}>{l.item.description}</td><td data-label={t('doc.qty')}>{l.item.qty} {l.item.unit}</td><td data-label={t('doc.lineTotal')} className="money">{inr2(l.total)}</td></tr>)}</tbody>
          </table>
          <div className="text-right mt-1">{t('doc.grandTotal')}: <strong className="money">{inr2(calc.total)}</strong></div>
          {pending.length > 0 && <p className="badge info mt-2">{t('pay.pending')}</p>}
        </section>

        {done ? (
          <section className="card !bg-[var(--ok-soft)]" role="status">
            <h2 className="mt-0">{t('pay.thanks')}</h2>
            <p className="m-0">{done === 'paid' ? t('pay.thanksPaid') : t('pay.thanksWrong')}</p>
          </section>
        ) : out > 0 && (
          <>
            {offer && (
              <section className="panel-red p-4 mb-3" aria-labelledby="offer">
                <div className="kicker !text-white/80">{t('pay.offerKicker')}</div>
                <h2 id="offer" className="display text-4xl m-0 mt-1">{t('pay.offerTitle', { pct: pctText })}</h2>
                <p className="text-lg mt-2 mb-0">{t('pay.offerBody', { net: inr(offer.netPaise), amount: inr(out), payBy: fmtDate(offer.payBy), discount: inr(offer.discountPaise) })}</p>
                {offer.status === 'accepted' ? (
                  <p className="font-bold mt-3 mb-0 bg-white text-[var(--ink)] p-3">✓ {t('pay.offerAccepted', { net: inr(offer.netPaise), date: fmtDate(offer.promisedOn) })}</p>
                ) : (
                  <div className="mt-3 bg-white text-[var(--ink)] p-3">
                    <label className="label" htmlFor="od">{t('pay.offerDate')}</label>
                    <input id="od" type="date" className="input" min={today} max={dateCap} value={pickDate} onChange={(e) => setOfferDate(e.target.value)} />
                    {err && <div className="err mt-1" role="alert">{err}</div>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button className="btn" onClick={acceptOffer}>{t('pay.offerAccept')}</button>
                      <button className="btn ghost" onClick={() => respondOffer(token, false)}>{t('pay.offerDecline')}</button>
                    </div>
                  </div>
                )}
              </section>
            )}
            {inv.offer?.status === 'declined' && <p className="hint">{t('pay.offerDeclined', { date: fmtDate(inv.dueDate) })}</p>}
            <section className="card mb-3">
              <h2 className="text-lg font-bold mt-0">{t('pay.payByUpi')}</h2>
              <div className="flex flex-wrap gap-4 items-center">
                <Qr text={upiLink(b, payAmt, inv.number)} size={140} label={t('doc.upiQr')} />
                <div className="flex-1 min-w-[200px]">
                  <a className="btn w-full" href={upiLink(b, payAmt, inv.number)} onClick={(e) => { e.preventDefault(); setMode('upi') }}>{t('pay.payNow', { amount: inr(payAmt) })}</a>
                  <p className="hint mt-2 mb-0">UPI: {b.upi}</p>
                  {mode === 'upi' && <p className="badge warn mt-2">{t('pay.simulated')}</p>}
                </div>
              </div>
            </section>

            <section className="card mb-3">
              <div className="grid gap-2">
                <button className="btn secondary" aria-expanded={mode === 'paid'} onClick={() => { setMode(mode === 'paid' ? null : 'paid'); setErr('') }}>{t('pay.alreadyPaid')}</button>
                {mode === 'paid' && (
                  <div>
                    <label className="label" htmlFor="ref">{t('pay.reference')}</label>
                    <input id="ref" className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / transaction ID" />
                    <label className="label mt-2" htmlFor="pon">{t('pay.date')}</label>
                    <input id="pon" type="date" className="input" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
                    {err && <div className="err mt-1" role="alert">{err}</div>}
                    <button className="btn mt-2 w-full" onClick={() => submit('paid')}>{t('pay.send')}</button>
                  </div>
                )}
                <button className="btn secondary" aria-expanded={mode === 'wrong'} onClick={() => { setMode(mode === 'wrong' ? null : 'wrong'); setErr('') }}>{t('pay.somethingWrong')}</button>
                {mode === 'wrong' && (
                  <div>
                    <label className="label" htmlFor="why">{t('pay.whatWrong')}</label>
                    <textarea id="why" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                    {err && <div className="err mt-1" role="alert">{err}</div>}
                    <button className="btn mt-2 w-full" onClick={() => submit('dispute')}>{t('pay.send')}</button>
                  </div>
                )}
              </div>
              {isDisputed(db, inv) && <p className="hint">{t('pay.pending')}</p>}
            </section>
          </>
        )}

        {others.length > 0 && (
          <section className="card mb-3">
            <h2 className="text-lg font-bold mt-0">{t('pay.others')}</h2>
            <ul className="m-0 pl-5">{others.map((o) => <li key={o.id}><Link to={`/pay/${o.token}`}>{o.number}</Link> · <strong className="money">{inr(outstandingOf(db, o))}</strong></li>)}</ul>
          </section>
        )}
        <p className="hint text-center">{t('pay.contact', { phone: b.phone, email: b.email })}</p>
        <p className="hint text-center">{t('pay.demoNote')}</p>
      </div>
    </main>
  )
}
