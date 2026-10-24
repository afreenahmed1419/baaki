import { useState } from 'react'
import { useApp } from '../store.jsx'
import { CONFIG } from '../config.js'
import { STATES, validateGstin } from '../lib/gst.js'
import { parseRupees } from '../lib/money.js'
import { addDays, fmtDate } from '../lib/dates.js'
import { Confirm, Field, PageTitle } from '../components/ui.jsx'

const rupees = (p) => String(p / 100)

export default function Settings() {
  const { db, today, t, setBusiness, setSettings, setLadder, reset } = useApp()
  const b = db.business
  const [gst, setGst] = useState(b.gstin)
  const [turn, setTurn] = useState(rupees(b.turnoverPaise))
  const [cash, setCash] = useState(rupees(b.cashPaise))
  const [buf, setBuf] = useState(rupees(db.settings.bufferPaise))
  const chk = b.registration === 'unregistered' ? null : validateGstin(gst)

  const onGstin = (v) => {
    const g = v.toUpperCase()
    setGst(g)
    setBusiness({ gstin: g })
    const c = validateGstin(g)
    if (c.ok) setBusiness({ gstin: g, stateCode: c.stateCode, state: c.state })
  }
  const money = (setter, key, target) => (e) => {
    setter(e.target.value)
    const p = parseRupees(e.target.value)
    if (p !== null && p >= 0) target(p)
    void key
  }
  const ladder = db.settings.ladder
  const setOffset = (id, v) => setLadder(ladder.map((s) => (s.id === id ? { ...s, offset: Number(v) } : s)))
  const onLogo = (e) => {
    const f = e.target.files?.[0]
    if (!f || f.size > 300000) return
    const r = new FileReader()
    r.onload = () => setBusiness({ logo: r.result })
    r.readAsDataURL(f)
  }

  return (
    <>
      <PageTitle title={t('nav.settings')} />

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('settings.business')}</h2>
        <div className="grid sm:grid-cols-2 gap-x-3">
          <Field label={t('cust.name')} id="bn"><input id="bn" className="input" value={b.name} onChange={(e) => setBusiness({ name: e.target.value })} /></Field>
          <Field label={t('settings.owner')} id="bo"><input id="bo" className="input" value={b.owner} onChange={(e) => setBusiness({ owner: e.target.value })} /></Field>
          <Field label={t('cust.address')} id="ba"><input id="ba" className="input" value={b.address} onChange={(e) => setBusiness({ address: e.target.value })} /></Field>
          <Field label={t('settings.registration')} id="br">
            <select id="br" className="input" value={b.registration} onChange={(e) => setBusiness({ registration: e.target.value })}>
              {['regular', 'composition', 'unregistered'].map((r) => <option key={r} value={r}>{t('settings.reg_' + r)}</option>)}
            </select>
          </Field>
          {b.registration !== 'unregistered' && (
            <Field label="GSTIN" id="bg" error={chk && !chk.ok ? t('err.gstin_' + chk.reason) : ''}>
              <input id="bg" className="input" maxLength={15} value={gst} onChange={(e) => onGstin(e.target.value)} />
              {chk?.ok && <div className="text-[var(--ok)] font-semibold mt-1">✓ {chk.state}</div>}
            </Field>
          )}
          <Field label={t('cust.state')} id="bs">
            <select id="bs" className="input" value={b.stateCode} onChange={(e) => setBusiness({ stateCode: e.target.value, state: STATES[e.target.value] })}>
              {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
            </select>
          </Field>
          <Field label={t('settings.turnover')} id="bt" hint={t('settings.turnoverHint')}><input id="bt" className="input" inputMode="decimal" value={turn} onChange={money(setTurn, 'turnover', (p) => setBusiness({ turnoverPaise: p }))} /></Field>
          <Field label={t('settings.cash')} id="bc"><input id="bc" className="input" inputMode="decimal" value={cash} onChange={money(setCash, 'cash', (p) => setBusiness({ cashPaise: p }))} /></Field>
          <Field label={t('cust.phone')} id="bp"><input id="bp" className="input" value={b.phone} onChange={(e) => setBusiness({ phone: e.target.value })} /></Field>
          <Field label={t('cust.email')} id="be"><input id="be" className="input" type="email" value={b.email} onChange={(e) => setBusiness({ email: e.target.value })} /></Field>
          <Field label="UPI ID" id="bu"><input id="bu" className="input" value={b.upi} onChange={(e) => setBusiness({ upi: e.target.value })} /></Field>
        </div>
        <fieldset className="border border-[var(--line)] p-3 mb-3">
          <legend className="font-bold px-1">{t('settings.bank')}</legend>
          <div className="grid sm:grid-cols-2 gap-x-3">
            <Field label={t('settings.accName')} id="bk1"><input id="bk1" className="input" value={b.bank.accountName} onChange={(e) => setBusiness({ bank: { ...b.bank, accountName: e.target.value } })} /></Field>
            <Field label={t('settings.bankName')} id="bk2"><input id="bk2" className="input" value={b.bank.bankName} onChange={(e) => setBusiness({ bank: { ...b.bank, bankName: e.target.value } })} /></Field>
            <Field label={t('settings.accNo')} id="bk3"><input id="bk3" className="input" value={b.bank.accountNo} onChange={(e) => setBusiness({ bank: { ...b.bank, accountNo: e.target.value } })} /></Field>
            <Field label="IFSC" id="bk4"><input id="bk4" className="input" value={b.bank.ifsc} onChange={(e) => setBusiness({ bank: { ...b.bank, ifsc: e.target.value.toUpperCase() } })} /></Field>
          </div>
        </fieldset>
        <fieldset className="border border-[var(--line)] p-3 mb-3">
          <legend className="font-bold px-1">Udyam (MSME)</legend>
          <label className="flex items-center gap-2 min-h-[48px]"><input type="checkbox" className="w-5 h-5" checked={b.udyam} onChange={(e) => setBusiness({ udyam: e.target.checked })} />{t('settings.udyam')}</label>
          {b.udyam && (
            <div className="grid sm:grid-cols-2 gap-x-3">
              <Field label={t('settings.udyamNo')} id="ud1"><input id="ud1" className="input" value={b.udyamNo} onChange={(e) => setBusiness({ udyamNo: e.target.value })} /></Field>
              <Field label={t('settings.udyamCat')} id="ud2"><select id="ud2" className="input" value={b.udyamCategory} onChange={(e) => setBusiness({ udyamCategory: e.target.value })}>
                {['micro', 'small', 'medium'].map((c) => <option key={c} value={c}>{t('settings.cat_' + c)}</option>)}</select></Field>
            </div>
          )}
        </fieldset>
        <Field label={t('settings.logo')} id="lg" hint={t('settings.logoHint')}>
          <input id="lg" type="file" accept="image/png,image/jpeg" className="input" onChange={onLogo} />
          {b.logo && <div className="mt-2 flex items-center gap-3"><img src={b.logo} alt={t('settings.logo')} className="max-h-16" /><button className="btn ghost small" onClick={() => setBusiness({ logo: null })}>{t('common.remove')}</button></div>}
        </Field>
      </section>

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('settings.ladder')}</h2>
        <p className="hint mt-0">{t('settings.ladderHint')}</p>
        <div className="grid sm:grid-cols-3 gap-x-3">
          {ladder.map((s) => (
            <Field key={s.id} label={t('stage.' + s.id)} id={`l-${s.id}`} hint={s.offset < 0 ? t('fu.before', { n: -s.offset }) : s.offset === 0 ? t('fu.onDue') : t('fu.after', { n: s.offset })}>
              <input id={`l-${s.id}`} type="number" className="input" value={s.offset} onChange={(e) => setOffset(s.id, e.target.value)} />
            </Field>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setLadder(CONFIG.ladder)}>{t('settings.ladderReset')}</button>
        <Field label={t('settings.buffer')} id="buf" hint={t('settings.bufferHint')}>
          <input id="buf" className="input max-w-xs" inputMode="decimal" value={buf} onChange={money(setBuf, 'buf', (p) => setSettings({ bufferPaise: p }))} />
        </Field>
      </section>

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('settings.display')}</h2>
        <div className="grid sm:grid-cols-2 gap-x-3">
          <Field label={t('settings.language')} id="lang">
            <select id="lang" className="input" value={db.settings.lang} onChange={(e) => setSettings({ lang: e.target.value })}><option value="en">English</option><option value="hi">हिंदी</option></select>
          </Field>
          <Field label={t('settings.textSize')} id="ts">
            <select id="ts" className="input" value={db.settings.textSize} onChange={(e) => setSettings({ textSize: e.target.value })}>
              {['normal', 'large', 'xlarge'].map((s) => <option key={s} value={s}>{t('settings.size_' + s)}</option>)}</select>
          </Field>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('settings.demo')}</h2>
        <p className="hint mt-0">{t('settings.demoHint')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('common.demoDate')} id="dd"><input id="dd" type="date" className="input" value={db.settings.demoDate} onChange={(e) => e.target.value && setSettings({ demoDate: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-2 mb-3">
            {[1, 7, 30].map((n) => <button key={n} className="btn secondary" onClick={() => setSettings({ demoDate: addDays(today, n) })}>+{n} {t('settings.days')}</button>)}
            <button className="btn ghost" onClick={() => setSettings({ demoDate: CONFIG.demoToday })}>{t('settings.backToStart')}</button>
          </div>
        </div>
        <p className="m-0">{t('common.today')}: <strong>{fmtDate(today)}</strong></p>
        <hr className="border-[var(--line)] my-3" />
        <Confirm message={t('settings.resetConfirm')} onYes={reset} className="btn danger">{t('settings.reset')}</Confirm>
      </section>
    </>
  )
}
