import { useApp } from '../store.jsx'
import { calcInvoice, STATES } from '../lib/gst.js'
import { amountInWords, inr2, num2 } from '../lib/money.js'
import { fmtDate } from '../lib/dates.js'
import { Qr, upiLink } from './ui.jsx'
import { CONFIG } from '../config.js'

// Print-ready A4 Tax Invoice / Bill of Supply / plain invoice, chosen by the business's registration.
export default function InvoiceDoc({ invoice, customer }) {
  const { db, t } = useApp()
  const b = db.business
  const calc = calcInvoice(invoice.items, b, invoice.placeStateCode)
  const intra = calc.intra
  const type = calc.docType
  const title = t(`doc.${type}`)
  const placeName = STATES[invoice.placeStateCode] || ''
  const showTax = type === 'tax_invoice'
  const hsnDigits = b.turnoverPaise > CONFIG.eInvoiceTurnoverPaise ? 6 : 4

  return (
    <article className="doc" aria-label={title}>
      {b.turnoverPaise > CONFIG.eInvoiceTurnoverPaise && type === 'tax_invoice' && (
        <p className="no-print err">{t('doc.einvoiceNote')}</p>
      )}
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '2px solid #000', paddingBottom: 8 }}>
        <div>
          {b.logo && <img src={b.logo} alt="" style={{ maxHeight: 48, marginBottom: 4 }} />}
          <h1>{title}</h1>
          {type === 'bill_of_supply' && <div style={{ fontSize: '9pt' }}>{t('doc.compositionLine')}</div>}
          <div style={{ fontWeight: 700, marginTop: 6 }}>{b.name}</div>
          <div>{b.address}</div>
          {type !== 'invoice' && <div>GSTIN: {b.gstin} · {b.state} ({b.stateCode})</div>}
          <div>{b.phone} · {b.email}</div>
          {b.udyam && <div>Udyam: {b.udyamNo}</div>}
        </div>
        <table style={{ width: 'auto', minWidth: 220, alignSelf: 'flex-start' }}>
          <tbody>
            <tr><th>{t('doc.invoiceNo')}</th><td>{invoice.number || t('doc.numberOnSave')}</td></tr>
            <tr><th>{t('doc.invoiceDate')}</th><td>{fmtDate(invoice.issued)}</td></tr>
            <tr><th>{t('doc.dueDate')}</th><td>{fmtDate(invoice.dueDate)}</td></tr>
            {type !== 'invoice' && <tr><th>{t('doc.placeOfSupply')}</th><td>{placeName} ({invoice.placeStateCode})</td></tr>}
            {showTax && <tr><th>{t('doc.reverseCharge')}</th><td>{invoice.reverseCharge ? t('common.yes') : t('common.no')}</td></tr>}
          </tbody>
        </table>
      </header>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>{t('doc.billTo')}</strong>
          <div style={{ fontWeight: 700 }}>{customer.name}</div>
          <div>{customer.address}</div>
          <div>{customer.gstin ? `GSTIN: ${customer.gstin}` : t('doc.unregisteredCustomer')}</div>
          <div>{STATES[customer.stateCode]} ({customer.stateCode})</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>{t('doc.deliverTo')}</strong>
          <div>{invoice.deliveryAddress || t('doc.sameAsBillTo')}</div>
        </div>
      </section>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>{t('doc.description')}</th><th>{hsnDigits === 6 ? 'HSN/SAC (6)' : 'HSN/SAC'}</th><th className="num">{t('doc.qty')}</th><th>{t('doc.unit')}</th>
              <th className="num">{t('doc.rate')}</th><th className="num">{t('doc.discount')}</th><th className="num">{t('doc.taxable')}</th>
              {showTax && intra && <><th className="num">CGST %</th><th className="num">CGST</th><th className="num">SGST %</th><th className="num">SGST</th></>}
              {showTax && !intra && <><th className="num">IGST %</th><th className="num">IGST</th></>}
              <th className="num">{t('doc.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {calc.lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{l.item.description}</td><td>{l.item.hsn}</td>
                <td className="num">{l.item.qty}</td><td>{l.item.unit}</td>
                <td className="num">{num2(l.item.ratePaise)}</td><td className="num">{l.discount ? num2(l.discount) : '–'}</td>
                <td className="num">{num2(l.taxable)}</td>
                {showTax && intra && <><td className="num">{l.rate / 2}%</td><td className="num">{num2(l.cgst)}</td><td className="num">{l.rate / 2}%</td><td className="num">{num2(l.sgst)}</td></>}
                {showTax && !intra && <><td className="num">{l.rate}%</td><td className="num">{num2(l.igst)}</td></>}
                <td className="num">{num2(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div><strong>{t('doc.amountInWords')}:</strong> {amountInWords(calc.total)}</div>
          <div style={{ marginTop: 8 }}>
            <strong>{t('doc.bankDetails')}</strong>
            <div>{b.bank.accountName} · {b.bank.bankName}</div>
            <div>A/c {b.bank.accountNo} · IFSC {b.bank.ifsc}</div>
            <div>UPI: {b.upi}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <Qr text={upiLink(b, calc.total, invoice.number || 'INV')} size={96} label={t('doc.upiQr')} />
            <div style={{ fontSize: '8pt' }}>{t('doc.scanToPay')}</div>
          </div>
        </div>
        <table style={{ width: 'auto', minWidth: 260, alignSelf: 'flex-start' }}>
          <tbody>
            <tr><th>{t('doc.taxableValue')}</th><td className="num">{inr2(calc.taxable)}</td></tr>
            {showTax && intra && <><tr><th>CGST</th><td className="num">{inr2(calc.cgst)}</td></tr><tr><th>SGST</th><td className="num">{inr2(calc.sgst)}</td></tr></>}
            {showTax && !intra && <tr><th>IGST</th><td className="num">{inr2(calc.igst)}</td></tr>}
            <tr><th>{t('doc.roundOff')}</th><td className="num">{calc.roundOff < 0 ? '-' : ''}{inr2(Math.abs(calc.roundOff))}</td></tr>
            <tr><th style={{ fontSize: '11pt' }}>{t('doc.grandTotal')}</th><td className="num" style={{ fontWeight: 700, fontSize: '11pt' }}>{inr2(calc.total)}</td></tr>
          </tbody>
        </table>
      </section>

      {invoice.creditNotePaise > 0 && (
        <p style={{ marginTop: 6 }}>{t('doc.creditNote')}: -{inr2(invoice.creditNotePaise)}</p>
      )}

      <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '8pt', maxWidth: 380 }}>
          {type === 'invoice' && <div>{t('doc.unregisteredNote')}</div>}
          <div>{t('doc.sampleNote')}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', minWidth: 180, paddingTop: 2 }}>{t('doc.signature')}</div>
          <div style={{ fontSize: '9pt' }}>{b.name}</div>
        </div>
      </footer>
    </article>
  )
}
