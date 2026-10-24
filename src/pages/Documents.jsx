import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { custOf, outstandingOf } from '../lib/ledger.js'
import { EventLine } from './InvoiceDetail.jsx'
import { Money, PageTitle } from '../components/ui.jsx'

export default function Documents() {
  const { db, t } = useApp()
  const invs = db.invoices.filter((i) => !i.draft).sort((a, b) => (a.number < b.number ? 1 : -1))
  return (
    <>
      <PageTitle title={t('nav.documents')} sub={t('docs.sub')} />
      <div className="grid gap-3">
        {invs.map((inv) => {
          const ev = db.events.filter((e) => e.invoiceId === inv.id).sort((a, b) => (a.date < b.date ? 1 : -1))
          return (
            <details key={inv.id} className="card">
              <summary className="cursor-pointer min-h-[48px] flex flex-wrap items-center justify-between gap-2">
                <span><strong>{inv.number}</strong> · {custOf(db, inv).name}<span className="hint"> · {t('docs.items', { n: ev.length })}</span></span>
                <Money p={outstandingOf(db, inv)} />
              </summary>
              <ul className="list-none p-0 mt-3 grid gap-2">{ev.map((e) => <EventLine key={e.id} e={e} />)}</ul>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link className="btn" to={`/documents/evidence/${inv.id}`}>{t('docs.evidence')}</Link>
                <Link className="btn secondary" to={`/invoices/${inv.id}`}>{t('docs.open')}</Link>
                <Link className="btn secondary" to={`/invoices/${inv.id}/print`}>{t('inv.openPdf')}</Link>
              </div>
            </details>
          )
        })}
      </div>
    </>
  )
}
