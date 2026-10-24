import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { custOf, outstandingOf } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import { inr, parseRupees } from '../lib/money.js'
import { Empty, Money, PageTitle } from '../components/ui.jsx'

function Item({ item }) {
  const { db, t, resolveInbox } = useApp()
  const inv = db.invoices.find((i) => i.id === item.invoiceId)
  const cust = custOf(db, inv)
  const [reply, setReply] = useState('')
  const [credit, setCredit] = useState('')
  const [err, setErr] = useState('')
  const isDispute = item.type === 'dispute'
  const isOffer = item.type === 'offer_accepted'
  const open = item.status === 'open'

  const accept = () => {
    if (isDispute) {
      const p = parseRupees(credit)
      if (!p || p <= 0 || p > outstandingOf(db, inv)) return setErr(t('err.creditAmount'))
      resolveInbox(item.id, 'credit_note', { amountPaise: p, reply })
    } else {
      resolveInbox(item.id, 'accept_paid', { reply })
    }
  }

  return (
    <article className="card">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <span className={`badge ${isDispute ? 'warn' : 'info'}`}>{t(isDispute ? 'inbox.dispute' : isOffer ? 'inbox.offerAccepted' : 'inbox.paidClaim')}</span>
          <h2 className="text-lg font-bold mt-1 mb-0">{cust.name}</h2>
          <div className="hint"><Link to={`/invoices/${inv.id}`}>{inv.number}</Link> · {fmtDate(item.createdAt)}</div>
        </div>
        <div className="text-right"><span className="hint">{t('inv.owed')}</span><div className="font-bold"><Money p={outstandingOf(db, inv)} /></div></div>
      </div>
      {item.ref && <p className="m-0 mt-2"><strong>{t('pay.reference')}:</strong> {item.ref} {item.paidOn && `· ${fmtDate(item.paidOn)}`}</p>}
      {isOffer ? (
        <p className="m-0 mt-2 font-bold">{t('inbox.offerBody', { net: inr(inv.offer?.netPaise || 0), date: fmtDate(item.promisedOn) })}</p>
      ) : (
        <blockquote className="m-0 mt-2 pl-3 border-l-4 border-[var(--line)]">{item.text}</blockquote>
      )}
      {open && isOffer ? (
        <div className="mt-3"><button className="btn" onClick={() => resolveInbox(item.id, 'ack', {})}>{t('inbox.gotIt')}</button></div>
      ) : open ? (
        <div className="mt-3">
          <p className="hint m-0 mb-2">{t('inbox.paused')}</p>
          {isDispute && (
            <div className="mb-2">
              <label className="label" htmlFor={`cr${item.id}`}>{t('inbox.creditAmount')}</label>
              <input id={`cr${item.id}`} className="input" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} />
              {err && <div className="err" role="alert">{err}</div>}
            </div>
          )}
          <label className="label" htmlFor={`rp${item.id}`}>{t('inbox.reply')}</label>
          <textarea id={`rp${item.id}`} className="input" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn" onClick={accept}>{t(isDispute ? 'inbox.acceptDispute' : 'inbox.acceptPaid')}</button>
            <button className="btn secondary" onClick={() => resolveInbox(item.id, 'reject', { reply })}>{t('inbox.reject')}</button>
            {isDispute && <Link className="btn secondary" to={`/new/${inv.id}`}>{t('common.edit')}</Link>}
            {isDispute && <button className="btn ghost" onClick={() => resolveInbox(item.id, 'corrected', { reply })}>{t('inbox.corrected')}</button>}
          </div>
        </div>
      ) : (
        <p className="mt-2 mb-0"><span className="badge neutral">{t('inbox.' + item.status)}</span> {item.reply}</p>
      )}
    </article>
  )
}

export default function Inbox() {
  const { db, t } = useApp()
  const open = db.inbox.filter((i) => i.status === 'open')
  const done = db.inbox.filter((i) => i.status !== 'open')
  return (
    <>
      <PageTitle title={t('nav.inbox')} sub={t('inbox.sub')} />
      {open.length === 0 ? <Empty>{t('inbox.none')}</Empty> : <div className="grid gap-3">{open.map((i) => <Item key={i.id} item={i} />)}</div>}
      {done.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-6">{t('inbox.resolved')}</h2>
          <div className="grid gap-3">{done.map((i) => <Item key={i.id} item={i} />)}</div>
        </>
      )}
    </>
  )
}
