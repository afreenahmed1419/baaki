import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { CONFIG } from '../config.js'
import { CATALOG } from '../data/invoices.js'
import { calcInvoice, docTypeFor, isValidInvoiceNumber, STATES, validateGstin } from '../lib/gst.js'
import { addDays } from '../lib/dates.js'
import { inr2, parseRupees } from '../lib/money.js'
import { Field, PageTitle } from '../components/ui.jsx'
import { mapScan, readInvoiceFile } from '../lib/scan.js'
import InvoiceDoc from '../components/InvoiceDoc.jsx'

const blankItem = () => ({ description: '', hsn: '', qty: '1', unit: 'pcs', rate: '', discountPct: '0', gstRate: 5 })
const toForm = (it) => ({ description: it.description, hsn: it.hsn, qty: String(it.qty), unit: it.unit, rate: String(it.ratePaise / 100), discountPct: String(it.discountPct || 0), gstRate: it.gstRate })

export default function NewInvoice() {
  const { id } = useParams()
  const nav = useNavigate()
  const { db, today, t, saveInvoice, addCustomer } = useApp()
  const existing = id ? db.invoices.find((i) => i.id === id) : null
  const [custId, setCustId] = useState(existing?.customerId || '')
  const [adding, setAdding] = useState(false)
  const [nc, setNc] = useState({ name: '', contact: '', phone: '', email: '', address: '', gstin: '', stateCode: '27', creditDays: 30 })
  const [items, setItems] = useState(existing ? existing.items.map(toForm) : [blankItem()])
  const [issued, setIssued] = useState(existing?.issued || today)
  const [due, setDue] = useState(existing?.dueDate || '')
  const [pos, setPos] = useState(existing?.placeStateCode || '')
  const [reverse, setReverse] = useState(existing?.reverseCharge || false)
  const [errors, setErrors] = useState([])
  const [preview, setPreview] = useState(false)
  const [flags, setFlags] = useState(new Set())
  const [scan, setScan] = useState({ busy: false, error: '', warnings: [], used: false })
  const [importedNumber, setImportedNumber] = useState('')
  const cls = (k) => 'input' + (flags.has(k) ? ' flagged' : '')

  const biz = db.business
  const docType = docTypeFor(biz)
  const cust = db.customers.find((c) => c.id === custId)
  const hsnMin = biz.turnoverPaise > CONFIG.eInvoiceTurnoverPaise ? 6 : 4
  const gstinCheck = nc.gstin ? validateGstin(nc.gstin) : null

  const placeCode = pos || cust?.stateCode || biz.stateCode
  const dueDate = due || (cust ? addDays(issued, cust.creditDays) : issued)

  const parsed = useMemo(() => items.map((it) => ({
    description: it.description, hsn: it.hsn, unit: it.unit, qty: Number(it.qty) || 0,
    ratePaise: parseRupees(it.rate) ?? 0, discountPct: Number(it.discountPct) || 0, gstRate: Number(it.gstRate),
  })), [items])
  const calc = calcInvoice(parsed, biz, placeCode)

  const setItem = (i, patch) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)))
  const addFromCatalog = (k) => {
    const c = CATALOG[k]
    if (!c) return
    setItems([...items.filter((it) => it.description || it.rate), { ...toForm({ ...c, qty: 1, discountPct: 0 }) }])
  }

  const onGstin = (v) => {
    const g = v.toUpperCase()
    const chk = validateGstin(g)
    setNc({ ...nc, gstin: g, ...(chk.ok ? { stateCode: chk.stateCode } : {}) })
  }
  const saveCustomer = () => {
    const errs = []
    if (!nc.name.trim()) errs.push(t('err.customerName'))
    if (nc.gstin && !gstinCheck.ok) errs.push(t('err.gstin_' + gstinCheck.reason))
    if (errs.length) return setErrors(errs)
    const cid = addCustomer({ ...nc, gstin: nc.gstin || null, creditDays: Number(nc.creditDays) || 30 })
    setCustId(cid); setAdding(false); setErrors([])
  }

  const runScan = async (file) => {
    if (!file) return
    setScan({ busy: true, error: '', warnings: [], used: false })
    try {
      const m = mapScan(await readInvoiceFile(file), db)
      setItems(m.items.length ? m.items : [blankItem()])
      setFlags(m.flags)
      if (m.customerId) { setCustId(m.customerId); setAdding(false) } else { setNc({ ...nc, ...m.newCustomer }); setAdding(true); setCustId('') }
      if (m.issued) setIssued(m.issued)
      setDue(m.dueDate || ''); setPos('')
      setImportedNumber(m.number)
      setScan({ busy: false, error: '', warnings: m.warnings, used: true })
    } catch (e) {
      setScan({ busy: false, error: String(e.message || 'ai_failed'), warnings: [], used: false })
    }
  }

  const validate = () => {
    const errs = []
    if (importedNumber) {
      if (!isValidInvoiceNumber(importedNumber)) errs.push(t('err.badNumber'))
      else if (db.invoices.some((i) => i.number === importedNumber && i.id !== existing?.id)) errs.push(t('err.dupNumber'))
    }
    if (!cust) errs.push(t('err.pickCustomer'))
    if (!items.length) errs.push(t('err.noItems'))
    items.forEach((it, i) => {
      const n = i + 1
      if (!it.description.trim()) errs.push(t('err.itemDesc', { n }))
      if (docType !== 'invoice' && !/^\d{4,8}$/.test(it.hsn) ) errs.push(t('err.itemHsn', { n }))
      else if (docType !== 'invoice' && it.hsn.length < hsnMin) errs.push(t('err.itemHsnDigits', { n, d: hsnMin }))
      if (!(Number(it.qty) > 0)) errs.push(t('err.itemQty', { n }))
      if (parseRupees(it.rate) === null || parseRupees(it.rate) <= 0) errs.push(t('err.itemRate', { n }))
      const d = Number(it.discountPct)
      if (d < 0 || d > 100 || Number.isNaN(d)) errs.push(t('err.itemDiscount', { n }))
    })
    return errs
  }

  const save = (send) => {
    const errs = validate()
    setErrors(errs)
    if (errs.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    const sid = saveInvoice({
      ...(existing ? { id: existing.id, number: existing.number } : {}),
      ...(importedNumber && !existing ? { number: importedNumber } : {}),
      customerId: cust.id, placeStateCode: placeCode, issued, dueDate, items: parsed, reverseCharge: reverse,
    }, { send })
    nav(`/invoices/${sid}`)
  }

  const draftInvoice = {
    number: existing?.number || importedNumber || '', issued, dueDate, placeStateCode: placeCode, items: parsed, reverseCharge: reverse,
    creditNotePaise: existing?.creditNotePaise || 0,
  }

  return (
    <>
      <div className="no-print">
      <PageTitle title={existing ? t('new.edit') : t('nav.new')} sub={t('doc.' + docType)} />
      {docType !== 'tax_invoice' && <p className="card !bg-[var(--warn-soft)]">{t('new.noGstNote_' + docType)}</p>}
      {errors.length > 0 && (
        <div className="card !border-[var(--bad)] !bg-[var(--bad-soft)] mb-4" role="alert">
          <strong>{t('err.fix')}</strong>
          <ul className="m-0 mt-1">{errors.map((e, i) => <li key={i} className="err">{e}</li>)}</ul>
        </div>
      )}

      {!existing && (
        <section className="card mb-4" aria-labelledby="scanh">
          <h2 id="scanh" className="text-lg font-bold mt-0">{t('scan.title')}</h2>
          <p className="hint mt-0">{t('scan.hint')}</p>
          <label className={`btn secondary cursor-pointer ${scan.busy ? 'opacity-60' : ''}`}>
            {scan.busy ? t('scan.reading') : t('scan.choose')}
            <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={scan.busy} onChange={(e) => { runScan(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {scan.error && <p className="err" role="alert">{t('scan.err_' + scan.error) === 'scan.err_' + scan.error ? t('scan.err_ai_failed') : t('scan.err_' + scan.error)}</p>}
          {scan.used && (
            <div className="mt-3" role="status">
              <p className="font-bold m-0">{t('scan.review')}</p>
              {scan.warnings.map((w, i) => (
                <p key={i} className="err m-0 mt-1">⚠ {t(w.key, Object.fromEntries(Object.entries(w.vars).map(([k, v]) => [k, typeof v === 'number' ? inr2(v) : v])))}</p>
              ))}
              <Field label={t('scan.number')} id="impno" hint={t('scan.numberHint')}>
                <input id="impno" className="input" maxLength={16} value={importedNumber} onChange={(e) => setImportedNumber(e.target.value)} />
              </Field>
            </div>
          )}
        </section>
      )}

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('new.customer')}</h2>
        {!adding ? (
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <Field label={t('inv.customer')} id="cust">
              <select id="cust" className="input" value={custId} onChange={(e) => { setCustId(e.target.value); setPos(''); setDue('') }}>
                <option value="">{t('new.pick')}</option>
                {db.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="mb-3"><button className="btn secondary" onClick={() => setAdding(true)}>+ {t('new.addCustomer')}</button></div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-3">
            <Field label={t('cust.name')} id="nn" flag={flags.has('customerName')}><input id="nn" className={cls('customerName')} value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
            <Field label={t('cust.contact')} id="nct"><input id="nct" className="input" value={nc.contact} onChange={(e) => setNc({ ...nc, contact: e.target.value })} /></Field>
            <Field label={t('cust.phone')} id="np"><input id="np" className="input" inputMode="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field>
            <Field label={t('cust.email')} id="ne"><input id="ne" className="input" type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
            <Field label={t('cust.address')} id="na"><input id="na" className="input" value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} /></Field>
            <Field label="GSTIN" id="ng" flag={flags.has('customerGstin')} hint={t('new.gstinHint')} error={gstinCheck && !gstinCheck.ok ? t('err.gstin_' + gstinCheck.reason) : ''}>
              <input id="ng" className={cls('customerGstin')} value={nc.gstin} maxLength={15} onChange={(e) => onGstin(e.target.value)} />
              {gstinCheck?.ok && <div className="text-[var(--ok)] font-semibold mt-1">✓ {t('new.gstinOk', { state: gstinCheck.state })}</div>}
            </Field>
            <Field label={t('cust.state')} id="ns">
              <select id="ns" className="input" value={nc.stateCode} disabled={gstinCheck?.ok} onChange={(e) => setNc({ ...nc, stateCode: e.target.value })}>
                {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
              </select>
            </Field>
            <Field label={t('cust.credit')} id="ncd"><input id="ncd" className="input" type="number" min="0" value={nc.creditDays} onChange={(e) => setNc({ ...nc, creditDays: e.target.value })} /></Field>
            <div className="sm:col-span-2 flex gap-2"><button className="btn" onClick={saveCustomer}>{t('common.save')}</button><button className="btn ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</button></div>
          </div>
        )}
        {cust && (
          <div className="grid sm:grid-cols-3 gap-x-3 mt-2">
            <Field label={t('doc.invoiceDate')} id="idt"><input id="idt" type="date" className="input" value={issued} onChange={(e) => setIssued(e.target.value)} /></Field>
            <Field label={t('doc.dueDate')} id="ddt" hint={t('new.dueHint', { n: cust.creditDays })}><input id="ddt" type="date" className="input" value={dueDate} onChange={(e) => setDue(e.target.value)} /></Field>
            {docType !== 'invoice' && (
              <Field label={t('doc.placeOfSupply')} id="pos" hint={calc.intra ? t('new.intra') : t('new.inter')}>
                <select id="pos" className="input" value={placeCode} onChange={(e) => setPos(e.target.value)}>
                  {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
                </select>
              </Field>
            )}
          </div>
        )}
      </section>

      <section className="card mb-4">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <h2 className="text-lg font-bold m-0">{t('new.items')}</h2>
          <select className="input !w-auto" aria-label={t('new.fromCatalog')} value="" onChange={(e) => addFromCatalog(e.target.value)}>
            <option value="">{t('new.fromCatalog')}</option>
            {Object.entries(CATALOG).map(([k, c]) => <option key={k} value={k}>{c.description}</option>)}
          </select>
        </div>
        {items.map((it, i) => {
          const l = calc.lines[i]
          return (
            <fieldset key={i} className="border border-[var(--line)] p-3 mb-3">
              <legend className="font-bold px-1">{t('new.item', { n: i + 1 })}</legend>
              <div className="grid sm:grid-cols-6 gap-x-3">
                <div className="sm:col-span-3"><Field label={t('doc.description')} id={`d${i}`} flag={flags.has(`i${i}.description`)}><input id={`d${i}`} className={cls(`i${i}.description`)} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></Field></div>
                <Field label={`HSN / SAC`} id={`h${i}`} flag={flags.has(`i${i}.hsn`)}><input id={`h${i}`} className={cls(`i${i}.hsn`)} inputMode="numeric" value={it.hsn} onChange={(e) => setItem(i, { hsn: e.target.value.replace(/\D/g, '') })} /></Field>
                <Field label={t('doc.qty')} id={`q${i}`} flag={flags.has(`i${i}.qty`)}><input id={`q${i}`} className={cls(`i${i}.qty`)} inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></Field>
                <Field label={t('doc.unit')} id={`u${i}`} flag={flags.has(`i${i}.unit`)}><input id={`u${i}`} className={cls(`i${i}.unit`)} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></Field>
                <Field label={t('doc.rate') + ' (₹)'} id={`r${i}`} flag={flags.has(`i${i}.rate`)}><input id={`r${i}`} className={cls(`i${i}.rate`)} inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></Field>
                <Field label={t('doc.discount') + ' %'} id={`ds${i}`} flag={flags.has(`i${i}.discountPct`)}><input id={`ds${i}`} className={cls(`i${i}.discountPct`)} inputMode="decimal" value={it.discountPct} onChange={(e) => setItem(i, { discountPct: e.target.value })} /></Field>
                {docType === 'tax_invoice' && (
                  <Field label="GST %" id={`g${i}`} flag={flags.has(`i${i}.gstRate`)}>
                    <select id={`g${i}`} className={cls(`i${i}.gstRate`)} value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>
                      {CONFIG.gstRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </Field>
                )}
                <div className="sm:col-span-2 flex items-end justify-between gap-2 mb-3">
                  <div><span className="hint">{t('doc.lineTotal')}</span><div className="font-bold money">{inr2(l.total)}</div></div>
                  {items.length > 1 && <button className="btn ghost small" onClick={() => setItems(items.filter((_, k) => k !== i))}>{t('common.remove')}</button>}
                </div>
              </div>
            </fieldset>
          )
        })}
        <button className="btn secondary" onClick={() => setItems([...items, blankItem()])}>+ {t('new.addItem')}</button>
      </section>

      <section className="card mb-4" aria-live="polite">
        <h2 className="text-lg font-bold mt-0">{t('new.totals')}</h2>
        <dl className="grid grid-cols-2 gap-1 m-0 max-w-md">
          <dt>{t('doc.taxableValue')}</dt><dd className="m-0 text-right money">{inr2(calc.taxable)}</dd>
          {docType === 'tax_invoice' && calc.intra && <><dt>CGST</dt><dd className="m-0 text-right money">{inr2(calc.cgst)}</dd><dt>SGST</dt><dd className="m-0 text-right money">{inr2(calc.sgst)}</dd></>}
          {docType === 'tax_invoice' && !calc.intra && <><dt>IGST</dt><dd className="m-0 text-right money">{inr2(calc.igst)}</dd></>}
          <dt>{t('doc.roundOff')}</dt><dd className="m-0 text-right money">{calc.roundOff < 0 ? '-' : ''}{inr2(Math.abs(calc.roundOff))}</dd>
          <dt className="font-extrabold text-lg">{t('doc.grandTotal')}</dt><dd className="m-0 text-right money font-extrabold text-lg">{inr2(calc.total)}</dd>
        </dl>
        {docType === 'tax_invoice' && (
          <label className="flex items-center gap-2 mt-3 min-h-[48px]"><input type="checkbox" className="w-5 h-5" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />{t('new.reverseCharge')}</label>
        )}
        {biz.turnoverPaise > CONFIG.eInvoiceTurnoverPaise && <p className="err">{t('doc.einvoiceNote')}</p>}
      </section>

      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn secondary" onClick={() => setPreview(!preview)}>{preview ? t('new.hidePreview') : t('new.preview')}</button>
        <button className="btn secondary" onClick={() => save(false)}>{t('new.saveDraft')}</button>
        <button className="btn" onClick={() => save(true)}>{t('new.send')}</button>
      </div>
      {preview && cust && <button className="btn ghost mb-2" onClick={() => window.print()}>{t('common.print')}</button>}
      {preview && !cust && <p className="err">{t('err.pickCustomer')}</p>}
      </div>
      {preview && cust && <InvoiceDoc invoice={draftInvoice} customer={cust} />}
    </>
  )
}
