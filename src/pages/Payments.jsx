import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import csvText from '../data/bank-statement.csv?raw'
import { matchRows, parseCsv } from '../lib/matching.js'
import { custOf, invOf, outstandingOf } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import { inr, parseRupees } from '../lib/money.js'
import { Empty, Field, Money, PageTitle } from '../components/ui.jsx'

const FLAG_TONE = { early_discount: 'ok', part_payment: 'info', multi_invoice: 'info', overpayment: 'warn', unmatched: 'bad', possible_tds: 'warn', duplicate: 'neutral' }

function Match({ m, onDone }) {
  const { db, t, confirmMatch, skipMatch } = useApp()
  const [manual, setManual] = useState('')
  const cust = m.customerId ? db.customers.find((c) => c.id === m.customerId) : null
  const tds = m.flags.includes('possible_tds')
  const disc = m.flags.includes('early_discount')
  const open = db.invoices.filter((i) => !i.draft && outstandingOf(db, i) > 0)

  return (
    <article className="card">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-bold">{m.row.description}</div>
          <div className="hint">{fmtDate(m.row.date)} · {m.row.reference}</div>
        </div>
        <div className="font-extrabold text-xl money">{inr(m.row.creditPaise)}</div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {m.flags.map((f) => <span key={f} className={`badge ${FLAG_TONE[f]}`}>{t('flag.' + f)}</span>)}
        {m.flags.length === 0 && <span className="badge ok">{t('flag.exact')}</span>}
        {m.confidence > 0 && <span className="badge neutral">{t('pm.confidence', { n: Math.round(m.confidence * 100) })}</span>}
      </div>
      <ul className="mt-2 mb-0 pl-5">{m.reasons.map((r) => <li key={r}>{t('why.' + r)}</li>)}</ul>
      {cust && <p className="m-0 mt-2"><strong>{cust.name}</strong></p>}
      {m.allocations.length > 0 && (
        <ul className="mt-1 mb-0 pl-5">
          {m.allocations.map((a) => { const inv = invOf(db, a.invoiceId); return <li key={a.invoiceId}><Link to={`/invoices/${inv.id}`}>{inv.number}</Link>: <Money p={a.amountPaise} /> {t('pm.of')} <Money p={outstandingOf(db, inv)} /></li> })}
        </ul>
      )}
      {m.excessPaise > 0 && <p className="m-0 mt-1 text-[var(--warn)] font-semibold">{t('pm.excess', { amount: inr(m.excessPaise) })}</p>}
      {tds && <p className="m-0 mt-1 text-[var(--warn)] font-semibold">{t('pm.tdsAsk')}</p>}

      {m.flags.includes('unmatched') && (
        <div className="mt-2">
          <label className="label" htmlFor={`mn-${m.id}`}>{t('pm.manual')}</label>
          <select id={`mn-${m.id}`} className="input" value={manual} onChange={(e) => setManual(e.target.value)}>
            <option value="">{t('new.pick')}</option>
            {open.map((i) => <option key={i.id} value={i.id}>{i.number} · {custOf(db, i).name} · {inr(outstandingOf(db, i))}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {(m.allocations.length > 0 || manual) && !disc && (
          <button className="btn" onClick={() => { confirmMatch(m, { manualInvoiceId: manual || null }); onDone() }}>{t('pm.confirm')}</button>
        )}
        {disc && m.allocations.length > 0 && (
          <button className="btn secondary" onClick={() => { confirmMatch(m, { settleDiscount: true }); onDone() }}>{t('pm.confirmDiscount')}</button>
        )}
        {tds && m.allocations.length > 0 && (
          <button className="btn secondary" onClick={() => { confirmMatch(m, { settleTds: true }); onDone() }}>{t('pm.confirmTds')}</button>
        )}
        <button className="btn ghost" onClick={() => { skipMatch(m); onDone() }}>{t('pm.skip')}</button>
      </div>
    </article>
  )
}

export default function Payments() {
  const { db, today, t, addPayment } = useApp()
  const [matches, setMatches] = useState(null)
  const [fileName, setFileName] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ invoiceId: '', amount: '', date: today, ref: '' })
  const [err, setErr] = useState('')

  const run = (text, name) => {
    try {
      const rows = parseCsv(text)
      const res = matchRows(db, rows, today)
      setMatches(res); setFileName(name); setMsg('')
    } catch { setMsg(t('pm.badFile')) }
  }
  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) run(await f.text(), f.name)
  }
  const remaining = (matches || []).filter((m) => m.status === 'pending' && !db.importedKeys.includes(m.key))
  const dups = (matches || []).filter((m) => m.status === 'duplicate')
  const refresh = () => setMatches((m) => (m ? [...m] : m))

  const open = db.invoices.filter((i) => !i.draft && outstandingOf(db, i) > 0)
  const addManual = (e) => {
    e.preventDefault()
    const p = parseRupees(form.amount)
    if (!form.invoiceId) return setErr(t('err.pickInvoice'))
    if (!p || p <= 0) return setErr(t('err.amount'))
    if (p > outstandingOf(db, invOf(db, form.invoiceId))) return setErr(t('err.tooMuch'))
    addPayment({ invoiceId: form.invoiceId, amountPaise: p, date: form.date, ref: form.ref, mode: 'Manual' })
    setForm({ ...form, amount: '', ref: '' }); setErr('')
  }
  const recent = [...db.payments].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8)

  return (
    <>
      <PageTitle title={t('nav.payments')} sub={t('pm.sub')} />
      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('pm.import')}</h2>
        <p className="hint mt-0">{t('pm.importHint')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="btn" onClick={() => run(csvText, 'bank-statement.csv')}>{t('pm.useSample')}</button>
          <label className="btn secondary cursor-pointer">{t('pm.upload')}<input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} /></label>
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
      </section>

      {matches && (
        <section className="mb-6" aria-live="polite">
          <h2 className="text-lg font-bold">{fileName}: {t('pm.toReview', { n: remaining.length })}</h2>
          <p className="hint">{t('pm.nothingPaid')}</p>
          {remaining.length === 0 && <Empty>{t('pm.allDone')}</Empty>}
          <div className="grid gap-3">{remaining.map((m) => <Match key={m.key} m={m} onDone={refresh} />)}</div>
          {dups.length > 0 && <p className="hint mt-3">{t('pm.dups', { n: dups.length })}</p>}
        </section>
      )}

      {db.unapplied.length > 0 && (
        <section className="card mb-4">
          <h2 className="text-lg font-bold mt-0">{t('pm.unapplied')}</h2>
          <ul className="m-0 pl-5">{db.unapplied.map((u) => <li key={u.id}>{fmtDate(u.date)} · {u.customerId ? db.customers.find((c) => c.id === u.customerId)?.name : '?'} · <Money p={u.amountPaise} /> · {u.ref}</li>)}</ul>
        </section>
      )}

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('pm.manualAdd')}</h2>
        <form onSubmit={addManual} className="grid sm:grid-cols-4 gap-x-3">
          <Field label={t('doc.invoiceNo')} id="mi"><select id="mi" className="input" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
            <option value="">{t('new.pick')}</option>{open.map((i) => <option key={i.id} value={i.id}>{i.number} · {custOf(db, i).name}</option>)}</select></Field>
          <Field label={t('pay.amount')} id="ma"><input id="ma" className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label={t('pay.date')} id="md"><input id="md" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label={t('pay.reference')} id="mr"><input id="mr" className="input" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></Field>
          {err && <div className="err sm:col-span-4" role="alert">{err}</div>}
          <div className="sm:col-span-4"><button className="btn" type="submit">{t('inv.savePayment')}</button></div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold mt-0">{t('pm.recent')}</h2>
        <ul className="m-0 pl-5">{recent.map((p) => <li key={p.id}>{fmtDate(p.date)} · {invOf(db, p.invoiceId)?.number} · <Money p={p.amountPaise} /> · {p.mode}</li>)}</ul>
      </section>
    </>
  )
}
