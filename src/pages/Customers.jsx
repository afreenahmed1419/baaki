import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { customerStats, isOpen } from '../lib/ledger.js'
import { STATES } from '../lib/gst.js'
import { GradeBadge, Money, PageTitle } from '../components/ui.jsx'

export default function Customers() {
  const { db, today, t, updateCustomer } = useApp()
  return (
    <>
      <PageTitle title={t('nav.customers')} sub={t('cust.sub')} />
      <div className="grid md:grid-cols-2 gap-3">
        {db.customers.map((c) => {
          const s = customerStats(db, c, today)
          const open = db.invoices.filter((i) => i.customerId === c.id && isOpen(db, i)).length
          return (
            <article key={c.id} className="card">
              <div className="flex justify-between gap-2 items-start">
                <div>
                  <h2 className="text-lg font-bold m-0">{c.name}</h2>
                  <div className="hint">{c.contact} · {STATES[c.stateCode]}{c.gstin ? '' : ` · ${t('doc.unregisteredCustomer')}`}</div>
                </div>
                <GradeBadge grade={s.grade} />
              </div>
              <p className="my-2">{t('cust.reason_' + s.grade, { avg: s.avgLate, pct: s.onTimePct })}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 m-0">
                <dt className="hint">{t('inv.owed')}</dt><dd className="m-0 font-bold"><Money p={s.owed} /> <span className="hint font-normal">({open})</span></dd>
                <dt className="hint">{t('cust.avgLate')}</dt><dd className="m-0">{t('cust.days', { n: s.avgLate })}</dd>
                <dt className="hint">{t('cust.onTime')}</dt><dd className="m-0">{s.onTimePct}%</dd>
                <dt className="hint">{t('cust.phone')}</dt><dd className="m-0">{c.phone}</dd>
              </dl>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label" htmlFor={`cd${c.id}`}>{t('cust.credit')}</label>
                  <input id={`cd${c.id}`} className="input" type="number" min="0" value={c.creditDays} onChange={(e) => updateCustomer(c.id, { creditDays: Math.max(0, Number(e.target.value) || 0) })} />
                </div>
                <div>
                  <label className="label" htmlFor={`cl${c.id}`}>{t('cust.lang')}</label>
                  <select id={`cl${c.id}`} className="input" value={c.lang} onChange={(e) => updateCustomer(c.id, { lang: e.target.value })}>
                    <option value="en">English</option><option value="hi">हिंदी</option>
                  </select>
                </div>
              </div>
              <Link to={`/invoices?c=${c.id}`} className="btn ghost small mt-3">{t('cust.viewInvoices')}</Link>
            </article>
          )
        })}
      </div>
    </>
  )
}
