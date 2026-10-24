import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { calcOf, custOf, daysOverdue, ladderOf, outstandingOf, paidOf, pauseReason, sentStageIds, statusOf, activePromise } from '../lib/ledger.js'
import { addDays, fmtDate } from '../lib/dates.js'
import { parseRupees, inr } from '../lib/money.js'
import { payLink } from '../lib/messages.js'
import { Field, Money, PageTitle, StatusBadge } from '../components/ui.jsx'

export function EventLine({ e }) {
  const { t } = useApp()
  const bits = [t('ev.' + e.type)]
  if (e.stage) bits.push(t('stage.' + e.stage))
  if (e.channel) bits.push(t('channel.' + e.channel))
  if (e.amountPaise) bits.push(inr(e.amountPaise))
  return (
    <li className="border-l-4 border-[var(--brand)] pl-3 py-1">
      <div className="font-semibold">{bits.join(' · ')}</div>
      <div className="hint">{fmtDate(e.date)}{e.text ? ` · ${e.text}` : ''}</div>
    </li>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { db, today, t, addPayment, promise, cancelPromise, sendDraft } = useApp()
  const inv = db.invoices.find((i) => i.id === id)
  const [amt, setAmt] = useState('')
  const [pdate, setPdate] = useState(today)
  const [pref, setPref] = useState('')
  const [until, setUntil] = useState(addDays(today, 5))
  const [err, setErr] = useState('')
  if (!inv) return <p>{t('common.notFound')}</p>

  const cust = custOf(db, inv)
  const calc = calcOf(db, inv)
  const st = statusOf(db, inv, today)
  const out = outstandingOf(db, inv)
  const od = daysOverdue(inv, today)
  const sent = sentStageIds(db, inv)
  const pause = pauseReason(db, inv, today)
  const pr = activePromise(db, inv, today)
  const events = db.events.filter((e) => e.invoiceId === inv.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const demandStage = ladderOf(db).find((s) => s.kind === 'letter')

  const pay = (e) => {
    e.preventDefault()
    const p = parseRupees(amt)
    if (!p || p <= 0) return setErr(t('err.amount'))
    if (p > out) return setErr(t('err.tooMuch'))
    addPayment({ invoiceId: inv.id, amountPaise: p, date: pdate, ref: pref, mode: 'Manual' })
    setAmt(''); setPref(''); setErr('')
  }

  return (
    <>
      <PageTitle title={inv.number} sub={`${cust.name} · ${t('doc.' + calc.docType)}`}>
        {inv.draft ? (
          <>
            <Link className="btn secondary" to={`/new/${inv.id}`}>{t('common.edit')}</Link>
            <button className="btn" onClick={() => sendDraft(inv.id)}>{t('new.send')}</button>
          </>
        ) : (
          <Link className="btn secondary" to={`/invoices/${inv.id}/print`}>{t('inv.openPdf')}</Link>
        )}
        <Link className="btn secondary" to={`/documents/evidence/${inv.id}`}>{t('docs.evidence')}</Link>
      </PageTitle>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid gap-4">
          <section className="card">
            <div className="flex flex-wrap items-center gap-2 mb-2"><StatusBadge status={st} />
              {od > 0 && out > 0 && <span className="badge bad">{t('chase.overdueDays', { n: od })}</span>}
              {pause && <span className="badge warn">{t('pause.' + pause)}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 m-0">
              <dt className="hint">{t('doc.invoiceDate')}</dt><dd className="m-0">{fmtDate(inv.issued)}</dd>
              <dt className="hint">{t('doc.dueDate')}</dt><dd className="m-0">{fmtDate(inv.dueDate)}</dd>
              <dt className="hint">{t('doc.taxableValue')}</dt><dd className="m-0"><Money p={calc.taxable} /></dd>
              <dt className="hint">GST</dt><dd className="m-0"><Money p={calc.tax} /></dd>
              <dt className="hint">{t('inv.total')}</dt><dd className="m-0"><Money p={calc.total} /></dd>
              <dt className="hint">{t('inv.paid')}</dt><dd className="m-0"><Money p={paidOf(db, inv)} /></dd>
              {inv.creditNotePaise > 0 && <><dt className="hint">{t('doc.creditNote')}</dt><dd className="m-0"><Money p={inv.creditNotePaise} /></dd></>}
              <dt className="font-bold">{t('inv.owed')}</dt><dd className="m-0 font-extrabold text-xl"><Money p={out} /></dd>
            </dl>
            {!inv.draft && <div className="hint mt-2">{t('pay.linkLabel')}: <a href={payLink(inv)} target="_blank" rel="noreferrer">{payLink(inv)}</a></div>}
          </section>

          {out > 0 && !inv.draft && (
            <section className="card">
              <h2 className="text-lg font-bold mt-0">{t('inv.recordPayment')}</h2>
              <form onSubmit={pay} className="grid sm:grid-cols-3 gap-3">
                <Field label={t('pay.amount')} id="amt" error={err}><input id="amt" className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={String(out / 100)} /></Field>
                <Field label={t('pay.date')} id="pd"><input id="pd" type="date" className="input" value={pdate} onChange={(e) => setPdate(e.target.value)} /></Field>
                <Field label={t('pay.reference')} id="pr"><input id="pr" className="input" value={pref} onChange={(e) => setPref(e.target.value)} /></Field>
                <div className="sm:col-span-3"><button className="btn" type="submit">{t('inv.savePayment')}</button></div>
              </form>
              <hr className="border-[var(--line)] my-3" />
              <h3 className="font-bold mt-0">{t('fu.promiseTitle')}</h3>
              {pr ? (
                <p className="m-0">{t('fu.promiseActive', { date: fmtDate(pr.until) })} <button className="btn ghost small" onClick={() => cancelPromise(pr.id)}>{t('fu.cancelPromise')}</button></p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={t('fu.promiseDate')} id="pu"><input id="pu" type="date" className="input" min={today} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
                  <button className="btn secondary mb-3" onClick={() => promise([inv.id], until)}>{t('fu.promiseSave')}</button>
                </div>
              )}
              {demandStage && od >= demandStage.offset && (
                <Link className="btn mt-2" to={`/letter/${inv.customerId}?inv=${inv.id}`}>{t('inv.makeLetter')}</Link>
              )}
            </section>
          )}
        </div>

        <div className="grid gap-4 content-start">
          <section className="card">
            <h2 className="text-lg font-bold mt-0">{t('inv.ladder')}</h2>
            <ol className="list-none p-0 m-0 grid gap-2">
              {ladderOf(db).map((s) => {
                const date = addDays(inv.dueDate, s.offset)
                const done = sent.has(s.id)
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className={`badge ${done ? 'ok' : date <= today && !inv.draft && out > 0 ? 'warn' : 'neutral'}`}>
                      {done ? t('inv.stepSent') : date <= today && out > 0 && !inv.draft ? t('inv.stepDue') : t('inv.stepLater')}
                    </span>
                    <span><strong>{t('stage.' + s.id)}</strong><span className="hint block">{fmtDate(date)}</span></span>
                  </li>
                )
              })}
            </ol>
          </section>
          <section className="card">
            <h2 className="text-lg font-bold mt-0">{t('inv.timeline')}</h2>
            <ul className="list-none p-0 m-0 grid gap-2">{events.map((e) => <EventLine key={e.id} e={e} />)}</ul>
          </section>
        </div>
      </div>
      <button className="btn ghost mt-4" onClick={() => nav(-1)}>{t('common.back')}</button>
    </>
  )
}
