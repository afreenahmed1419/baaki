import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { CONFIG } from '../config.js'
import { daysOverdue, isOpen, ladderOf, msmeInterest, outstandingOf, paidOf, totalOf } from '../lib/ledger.js'
import { addDays, fmtDate } from '../lib/dates.js'
import { inr2 } from '../lib/money.js'
import { Qr, upiLink } from '../components/ui.jsx'

// "Payment Demand Letter": from the business about money owed. NOT a GST notice and NOT a legal notice.
export default function LetterPage() {
  const { customerId } = useParams()
  const [sp] = useSearchParams()
  const { db, today, t } = useApp()
  const [withInterest, setWithInterest] = useState(false)
  const cust = db.customers.find((c) => c.id === customerId)
  if (!cust) return <p>{t('common.notFound')}</p>
  const b = db.business
  const demand = ladderOf(db).find((s) => s.kind === 'letter')
  const ids = sp.get('inv')?.split(',').filter(Boolean)
  const invs = db.invoices
    .filter((i) => i.customerId === cust.id && isOpen(db, i) && (ids ? ids.includes(i.id) : daysOverdue(i, today) >= (demand?.offset ?? 30)))
    .sort((a, b2) => (a.dueDate < b2.dueDate ? -1 : 1))

  const deadline = addDays(today, CONFIG.demandDeadlineDays)
  const msme = b.udyam && ['micro', 'small'].includes(b.udyamCategory)
  const rows = invs.map((i) => ({ i, total: totalOf(db, i), paid: paidOf(db, i), credit: i.creditNotePaise || 0, out: outstandingOf(db, i), int: msmeInterest(outstandingOf(db, i), i, today) }))
  const sumOut = rows.reduce((a, r) => a + r.out, 0)
  const sumInt = rows.reduce((a, r) => a + r.int.interestPaise, 0)
  const demanded = sumOut + (withInterest ? sumInt : 0)

  return (
    <>
      <div className="no-print flex flex-wrap gap-2 mb-3 items-center">
        <button className="btn" onClick={() => window.print()}>{t('common.print')}</button>
        <Link className="btn secondary" to="/followups">{t('common.back')}</Link>
        {msme && sumInt > 0 && (
          <label className="flex items-center gap-2 min-h-[48px]"><input type="checkbox" className="w-5 h-5" checked={withInterest} onChange={(e) => setWithInterest(e.target.checked)} />{t('letter.includeInterest')}</label>
        )}
      </div>
      {rows.length === 0 ? <p>{t('letter.none')}</p> : (
        <article className="doc" aria-label={t('letter.title')}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              {b.logo && <img src={b.logo} alt="" style={{ maxHeight: 48, marginBottom: 4 }} />}
              <div style={{ fontWeight: 700, fontSize: '13pt' }}>{b.name}</div>
              <div>{b.address}</div>
              <div>{b.phone} · {b.email}</div>
            </div>
            <div style={{ textAlign: 'right' }}>{t('letter.date')}: {fmtDate(today)}</div>
          </header>

          <h1 style={{ marginTop: 16 }}>{t('letter.title')}</h1>
          <p style={{ border: '1.5px solid #000', padding: 8, fontWeight: 600 }}>{t('letter.disclaimer', { business: b.name })}</p>

          <p><strong>{t('letter.to')}:</strong><br />{cust.name}<br />{t('letter.attn')} {cust.contact}<br />{cust.address}</p>

          <p>{t('letter.intro', { business: b.name, total: inr2(demanded) })}</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>{t('doc.invoiceNo')}</th><th>{t('doc.invoiceDate')}</th><th>{t('doc.dueDate')}</th><th className="num">{t('inv.total')}</th><th className="num">{t('letter.partPaid')}</th><th className="num">{t('letter.stillOwed')}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.i.id}><td>{r.i.number}</td><td>{fmtDate(r.i.issued)}</td><td>{fmtDate(r.i.dueDate)}</td><td className="num">{inr2(r.total)}</td><td className="num">{inr2(r.paid + r.credit)}</td><td className="num">{inr2(r.out)}</td></tr>
                ))}
                <tr><th colSpan={5}>{t('letter.totalOwed')}</th><th className="num">{inr2(sumOut)}</th></tr>
                {withInterest && sumInt > 0 && <tr><th colSpan={5}>{t('letter.interestAdded')}</th><th className="num">{inr2(sumInt)}</th></tr>}
                {withInterest && sumInt > 0 && <tr><th colSpan={5}>{t('letter.totalDemanded')}</th><th className="num">{inr2(demanded)}</th></tr>}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10 }}><strong>{t('letter.deadline', { date: fmtDate(deadline), n: CONFIG.demandDeadlineDays })}</strong></p>

          <section style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <strong>{t('letter.howToPay')}</strong>
              <div>{b.bank.accountName} · {b.bank.bankName}</div>
              <div>A/c {b.bank.accountNo} · IFSC {b.bank.ifsc}</div>
              <div>UPI: {b.upi}</div>
              <div>{t('letter.refNote')}</div>
            </div>
            <div><Qr text={upiLink(b, demanded, rows.map((r) => r.i.number.slice(-4)).join(','))} size={100} label={t('doc.upiQr')} /></div>
          </section>

          <p style={{ marginTop: 10 }}>{t('letter.dispute', { owner: b.owner, phone: b.phone, email: b.email })}</p>

          {msme && (
            <div style={{ borderTop: '1px solid #999', marginTop: 10, paddingTop: 6 }}>
              <p style={{ margin: 0 }}>{t('letter.msme', { days: CONFIG.msmedMaxCreditDays })}</p>
              {sumInt > 0 && (
                <p style={{ margin: '6px 0 0' }}>
                  {t('letter.msmeInterest', { amount: inr2(sumInt), rate: (CONFIG.rbiBankRatePct * CONFIG.msmedInterestMultiplier).toFixed(1) })}
                  {!withInterest && ' ' + t('letter.msmeNotAdded')}
                </p>
              )}
            </div>
          )}

          <footer style={{ marginTop: 30 }}>
            <div>{t('letter.regards')},</div>
            <div style={{ marginTop: 28, borderTop: '1px solid #000', display: 'inline-block', minWidth: 200, paddingTop: 2 }}>{b.owner}, {b.name}</div>
          </footer>
        </article>
      )}
    </>
  )
}
