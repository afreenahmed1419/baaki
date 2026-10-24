import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { custOf } from '../lib/ledger.js'
import InvoiceDoc from '../components/InvoiceDoc.jsx'

export default function InvoicePrint() {
  const { id } = useParams()
  const { db, t } = useApp()
  const inv = db.invoices.find((i) => i.id === id)
  if (!inv) return <p>{t('common.notFound')}</p>
  return (
    <>
      <div className="no-print flex gap-2 mb-3">
        <button className="btn" onClick={() => window.print()}>{t('common.print')}</button>
        <Link className="btn secondary" to={`/invoices/${inv.id}`}>{t('common.back')}</Link>
      </div>
      <InvoiceDoc invoice={inv} customer={custOf(db, inv)} />
    </>
  )
}
