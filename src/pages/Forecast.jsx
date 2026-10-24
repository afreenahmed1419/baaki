import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { coverGap, custOf, customerStats, forecast, invOf } from '../lib/ledger.js'
import { inr, inrShort } from '../lib/money.js'
import { fmtDate, fmtDateShort } from '../lib/dates.js'
import { Money, PageTitle } from '../components/ui.jsx'

function Chart({ fc, t }) {
  const W = 720, H = 260, P = { l: 56, r: 12, t: 14, b: 34 }
  const vals = fc.weeks.map((w) => w.closing)
  const max = Math.max(...vals, fc.buffer, 1), min = Math.min(...vals, 0)
  const x = (i) => P.l + (i + 0.5) * ((W - P.l - P.r) / fc.weeks.length)
  const y = (v) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b)
  const bw = ((W - P.l - P.r) / fc.weeks.length) * 0.6
  const ticks = [min, 0, fc.buffer, max].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={t('fc.chartLabel', { low: inr(fc.lowest.closing), week: fc.lowest.index + 1 })}>
      {ticks.map((v) => (
        <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#ddd8cc" /><text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5b5b53">{inrShort(v)}</text></g>
      ))}
      <line x1={P.l} x2={W - P.r} y1={y(fc.buffer)} y2={y(fc.buffer)} stroke="#8a4b00" strokeWidth="2" strokeDasharray="6 4" />
      <text x={W - P.r} y={y(fc.buffer) - 5} textAnchor="end" fontSize="11" fill="#8a4b00" fontWeight="700">{t('fc.buffer')}</text>
      {fc.weeks.map((w, i) => {
        const below = w.closing < fc.buffer
        const top = Math.min(y(w.closing), y(0)), h = Math.abs(y(w.closing) - y(0))
        return (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(2, h)} fill={below ? '#a1241b' : '#0b5d4b'} rx="2">
              <title>{`${t('fc.week')} ${i + 1}: ${inr(w.closing)}`}</title>
            </rect>
            <text x={x(i)} y={H - 16} textAnchor="middle" fontSize="11" fill="#1b1b18">{i + 1}</text>
            {below && <text x={x(i)} y={top - 4} textAnchor="middle" fontSize="12" fill="#a1241b" fontWeight="800">!</text>}
          </g>
        )
      })}
      <text x={(W + P.l) / 2} y={H - 2} textAnchor="middle" fontSize="11" fill="#5b5b53">{t('fc.week')}</text>
    </svg>
  )
}

export default function Forecast() {
  const { db, today, t } = useApp()
  const [what, setWhat] = useState({ delayBiggest: false, bigOrder: false, supplierDelay: false })
  const biggest = [...db.customers].sort((a, b) => customerStats(db, b, today).owed - customerStats(db, a, today).owed)[0]
  const opts = { delayCustomerId: what.delayBiggest ? biggest.id : null, bigOrder: what.bigOrder, supplierDelay: what.supplierDelay }
  const fc = forecast(db, today, opts)
  const gap = coverGap(db, today, fc, opts)
  const toggle = (k) => setWhat({ ...what, [k]: !what[k] })

  return (
    <>
      <PageTitle title={t('nav.forecast')} sub={t('fc.sub')} />

      {fc.firstBelow ? (
        <div className="card !border-[var(--bad)] !bg-[var(--bad-soft)] mb-4" role="status">
          <div className="font-extrabold text-lg text-[var(--bad)]">{t('dash.warnTitle', { amount: inr(fc.shortfall), week: fc.firstBelow.index + 1, date: fmtDate(fc.firstBelow.start) })}</div>
          <div>{t('fc.lowestLine', { amount: inr(fc.lowest.closing), week: fc.lowest.index + 1, date: fmtDate(fc.lowest.start) })}</div>
        </div>
      ) : <div className="card !bg-[var(--ok-soft)] font-bold text-[var(--ok)] mb-4">{t('dash.allClear')}</div>}

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('fc.whatIf')}</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          {[
            ['delayBiggest', t('fc.ifDelay', { name: biggest.name })],
            ['bigOrder', t('fc.ifOrder')],
            ['supplierDelay', t('fc.ifSupplier')],
          ].map(([k, label]) => (
            <label key={k} className={`flex items-center gap-3 min-h-[48px] p-2 border-2 cursor-pointer ${what[k] ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--line)]'}`}>
              <input type="checkbox" className="w-6 h-6" checked={what[k]} onChange={() => toggle(k)} /><span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="text-lg font-bold mt-0">{t('fc.chartTitle')}</h2>
        <Chart fc={fc} t={t} />
        <p className="hint mb-0">{t('fc.chartNote')}</p>
      </section>

      {fc.firstBelow && (
        <section className="card mb-4">
          <h2 className="text-lg font-bold mt-0">{t('fc.coverTitle', { amount: inr(fc.shortfall) })}</h2>
          {gap.picks.length === 0 ? <p>{t('dash.warnNoFix')}</p> : (
            <>
              <ul className="list-none p-0 m-0 grid gap-2">
                {gap.picks.map(({ inv, amountPaise, od }) => (
                  <li key={inv.id} className="flex justify-between gap-3 border-t border-[var(--line)] pt-2">
                    <span><Link to={`/invoices/${inv.id}`} className="font-bold">{inv.number}</Link> · {custOf(db, inv).name}<span className="hint block">{od > 0 ? t('chase.overdueDays', { n: od }) : t('fc.later')}</span></span>
                    <Money p={amountPaise} className="font-bold" />
                  </li>
                ))}
              </ul>
              <p className={`font-bold mb-0 ${gap.covered ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                {gap.covered ? t('fc.covered', { amount: inr(gap.total) }) : t('fc.notCovered', { amount: inr(gap.total) })}
              </p>
            </>
          )}
          <Link to="/chase" className="btn mt-3">{t('nav.chase')}</Link>
        </section>
      )}

      <section aria-labelledby="wk">
        <h2 id="wk" className="text-lg font-bold">{t('fc.tableTitle')}</h2>
        <table className="stack-table">
          <thead><tr><th>{t('fc.week')}</th><th>{t('fc.opening')}</th><th>{t('fc.in')}</th><th>{t('fc.out')}</th><th>{t('fc.closing')}</th></tr></thead>
          <tbody>
            {fc.weeks.map((w) => (
              <tr key={w.index} className={w.closing < fc.buffer ? 'bg-[var(--bad-soft)]' : ''}>
                <td data-label={t('fc.week')}><strong>{w.index + 1}</strong> <span className="hint">{fmtDateShort(w.start)}–{fmtDateShort(w.end)}</span></td>
                <td data-label={t('fc.opening')}><Money p={w.opening} /></td>
                <td data-label={t('fc.in')}>
                  <details><summary className="cursor-pointer min-h-[32px]"><Money p={w.in} /></summary>
                    <ul className="m-0 pl-4 text-sm">{w.ins.map((x, i) => <li key={i}>{x.invoiceId ? invOf(db, x.invoiceId).number : t('fc.' + x.label)} · {inr(x.amountPaise)}</li>)}</ul></details>
                </td>
                <td data-label={t('fc.out')}>
                  <details><summary className="cursor-pointer min-h-[32px]"><Money p={w.out} /></summary>
                    <ul className="m-0 pl-4 text-sm">{w.outs.map((x, i) => <li key={i}>{x.expenseId ? x.label : t('fc.' + x.label)} · {inr(x.amountPaise)}</li>)}</ul></details>
                </td>
                <td data-label={t('fc.closing')}><Money p={w.closing} className={`font-bold ${w.closing < 0 ? 'text-[var(--bad)]' : ''}`} />{w.closing < fc.buffer && <span className="badge bad ml-2">{t('fc.belowBuffer')}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {fc.doubtful.length > 0 && (
          <div className="card mt-3">
            <strong>{t('fc.doubtfulTitle')}</strong>
            <p className="hint m-0">{t('fc.doubtfulNote')}</p>
            <ul className="m-0 pl-5">{fc.doubtful.map((d) => <li key={d.invoiceId}>{invOf(db, d.invoiceId).number} · {custOf(db, invOf(db, d.invoiceId)).name} · {inr(d.amountPaise)} ({t('fc.reason_' + d.reason)})</li>)}</ul>
          </div>
        )}
        <p className="hint">{t('fc.method')}</p>
      </section>
    </>
  )
}
