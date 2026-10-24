import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { custOf, outstandingOf, paidOf, totalOf } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import { inr2 } from '../lib/money.js'
import InvoiceDoc from '../components/InvoiceDoc.jsx'

// Everything about one invoice on print-ready pages: the invoice, payments, reminders, replies.
export default function EvidencePage() {
  const { id } = useParams()
  const { db, today, t } = useApp()
  const inv = db.invoices.find((i) => i.id === id)
  if (!inv) return <p>{t('common.notFound')}</p>
  const cust = custOf(db, inv)
  const events = db.events.filter((e) => e.invoiceId === id).sort((a, b) => (a.date < b.date ? -1 : 1))
  const pays = db.payments.filter((p) => p.invoiceId === id).sort((a, b) => (a.date < b.date ? -1 : 1))
  const sent = events.filter((e) => ['reminder', 'letter', 'advice'].includes(e.type))
  const replies = events.filter((e) => ['dispute', 'claim', 'promise', 'resolved', 'note'].includes(e.type))

  return (
    <>
      <div className="no-print flex gap-2 mb-3">
        <button className="btn" onClick={() => window.print()}>{t('common.print')}</button>
        <Link className="btn secondary" to={`/invoices/${id}`}>{t('common.back')}</Link>
      </div>
      <article className="doc" aria-label={t('docs.evidence')}>
        <h1>{t('ev.packTitle')}</h1>
        <p style={{ margin: '4px 0' }}>{t('ev.packFor', { number: inv.number, customer: cust.name })} · {t('ev.generated', { date: fmtDate(today) })}</p>
        <table>
          <tbody>
            <tr><th>{t('inv.total')}</th><td className="num">{inr2(totalOf(db, inv))}</td><th>{t('inv.paid')}</th><td className="num">{inr2(paidOf(db, inv))}</td><th>{t('inv.owed')}</th><td className="num">{inr2(outstandingOf(db, inv))}</td></tr>
          </tbody>
        </table>

        <h2 style={{ fontSize: '12pt', marginBottom: 4 }}>1. {t('ev.sec_payments')}</h2>
        {pays.length ? (
          <table><thead><tr><th>{t('pay.date')}</th><th>{t('pay.reference')}</th><th>Mode</th><th className="num">{t('pay.amount')}</th></tr></thead>
            <tbody>{pays.map((p) => <tr key={p.id}><td>{fmtDate(p.date)}</td><td>{p.ref}</td><td>{p.mode}</td><td className="num">{inr2(p.amountPaise)}</td></tr>)}</tbody></table>
        ) : <p>{t('ev.nonePayments')}</p>}

        <h2 style={{ fontSize: '12pt', marginBottom: 4 }}>2. {t('ev.sec_reminders')}</h2>
        {sent.length ? (
          <table><thead><tr><th>{t('pay.date')}</th><th>{t('ev.step')}</th><th>{t('ev.channel')}</th></tr></thead>
            <tbody>{sent.map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{t('stage.' + e.stage)}</td><td>{e.channel ? t('channel.' + e.channel) : ''}</td></tr>)}</tbody></table>
        ) : <p>{t('ev.noneReminders')}</p>}

        <h2 style={{ fontSize: '12pt', marginBottom: 4 }}>3. {t('ev.sec_replies')}</h2>
        {replies.length ? (
          <table><thead><tr><th>{t('pay.date')}</th><th>{t('ev.what')}</th><th>{t('ev.detail')}</th></tr></thead>
            <tbody>{replies.map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{t('ev.' + e.type)}</td><td>{e.text}</td></tr>)}</tbody></table>
        ) : <p>{t('ev.noneReplies')}</p>}

        <h2 style={{ fontSize: '12pt', marginBottom: 4 }}>4. {t('ev.sec_timeline')}</h2>
        <table><tbody>{events.map((e) => <tr key={e.id}><td style={{ width: 90 }}>{fmtDate(e.date)}</td><td>{t('ev.' + e.type)}{e.stage ? ` · ${t('stage.' + e.stage)}` : ''}{e.amountPaise ? ` · ${inr2(e.amountPaise)}` : ''}</td></tr>)}</tbody></table>

        <div className="page-break" />
        <h2 style={{ fontSize: '12pt' }}>5. {t('ev.sec_invoice')}</h2>
      </article>
      <InvoiceDoc invoice={inv} customer={cust} />
    </>
  )
}
