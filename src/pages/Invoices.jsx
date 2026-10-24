import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { custOf, daysOverdue, outstandingOf, statusOf, totalOf } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import { Empty, Money, PageTitle, StatusBadge } from '../components/ui.jsx'

const STATUSES = ['draft', 'sent', 'due_soon', 'overdue', 'part_paid', 'paid', 'disputed']

export default function Invoices() {
  const { db, today, t } = useApp()
  const [q, setQ] = useState('')
  const [sp] = useSearchParams()
  const [cust, setCust] = useState(sp.get('c') || '')
  const [status, setStatus] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [minOd, setMinOd] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.invoices
      .map((inv) => ({ inv, c: custOf(db, inv), st: statusOf(db, inv, today), od: daysOverdue(inv, today) }))
      .filter(({ inv, c, st, od }) =>
        (!needle || inv.number.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle)) &&
        (!cust || inv.customerId === cust) && (!status || st === status) &&
        (!dueFrom || inv.dueDate >= dueFrom) && (!dueTo || inv.dueDate <= dueTo) &&
        (minOd === '' || (st !== 'paid' && st !== 'draft' && od >= Number(minOd))))
      .sort((a, b) => (a.inv.number < b.inv.number ? 1 : -1))
  }, [db, today, q, cust, status, dueFrom, dueTo, minOd])

  return (
    <>
      <PageTitle title={t('nav.invoices')} sub={t('inv.count', { n: rows.length })}>
        <Link className="btn" to="/new">+ {t('nav.new')}</Link>
      </PageTitle>

      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label" htmlFor="q">{t('common.search')}</label><input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('inv.searchHint')} /></div>
        <div><label className="label" htmlFor="fc">{t('inv.customer')}</label>
          <select id="fc" className="input" value={cust} onChange={(e) => setCust(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {db.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="fs">{t('inv.status')}</label>
          <select id="fs" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}
          </select></div>
        <div><label className="label" htmlFor="df">{t('inv.dueFrom')}</label><input id="df" type="date" className="input" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor="dt">{t('inv.dueTo')}</label><input id="dt" type="date" className="input" value={dueTo} onChange={(e) => setDueTo(e.target.value)} /></div>
        <div><label className="label" htmlFor="mo">{t('inv.minOverdue')}</label><input id="mo" type="number" min="0" className="input" value={minOd} onChange={(e) => setMinOd(e.target.value)} /></div>
      </div>

      {rows.length === 0 ? <Empty>{t('inv.none')}</Empty> : (
        <table className="stack-table">
          <thead><tr><th>{t('doc.invoiceNo')}</th><th>{t('inv.customer')}</th><th>{t('doc.dueDate')}</th><th>{t('inv.status')}</th><th>{t('inv.total')}</th><th>{t('inv.owed')}</th></tr></thead>
          <tbody>
            {rows.map(({ inv, c, st, od }) => (
              <tr key={inv.id}>
                <td data-label={t('doc.invoiceNo')}><Link to={`/invoices/${inv.id}`} className="font-bold">{inv.number}</Link></td>
                <td data-label={t('inv.customer')}>{c.name}</td>
                <td data-label={t('doc.dueDate')}>{fmtDate(inv.dueDate)}{st !== 'paid' && st !== 'draft' && od > 0 && <div className="hint">{t('chase.overdueDays', { n: od })}</div>}</td>
                <td data-label={t('inv.status')}><StatusBadge status={st} /></td>
                <td data-label={t('inv.total')}><Money p={totalOf(db, inv)} /></td>
                <td data-label={t('inv.owed')}><Money p={outstandingOf(db, inv)} className="font-bold" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
