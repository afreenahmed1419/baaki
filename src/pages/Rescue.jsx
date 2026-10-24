import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { CONFIG } from '../config.js'
import { buildRescue } from '../lib/rescue.js'
import { buildOfferMessage, channelHref } from '../lib/messages.js'
import { custOf, daysOverdue } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import { inr, inrShort } from '../lib/money.js'
import { Empty } from '../components/ui.jsx'

const pctText = (bp) => `${(bp / 100).toString().replace(/\.0+$/, '')}%`

function Step({ n, title, children }) {
  return (
    <li className="grid grid-cols-[3.2rem_1fr] sm:grid-cols-[5rem_1fr] gap-3 py-5 border-t-[3px] border-[var(--rule)]">
      <div className="display text-6xl sm:text-7xl text-[var(--bad)]">{n}</div>
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-3xl m-0">{title}</h2>
        {children}
      </div>
    </li>
  )
}

function OfferCard({ c }) {
  const { db, today, lang, t, sendOffer } = useApp()
  const inv = db.invoices.find((i) => i.id === c.invoiceId)
  const cust = custOf(db, inv)
  const m = buildOfferMessage(db, c, lang)
  const o = inv.offer
  const send = (channel) => {
    window.open(channelHref[channel](cust, m.text, m.subject), '_blank', 'noopener')
    sendOffer(c, channel, m.text)
  }
  return (
    <article className="card mt-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="text-xl m-0">{cust.name}</h3>
          <div className="hint"><Link to={`/invoices/${inv.id}`}>{inv.number}</Link> · {t('chase.overdueDays', { n: Math.max(0, daysOverdue(inv, today)) })}</div>
        </div>
        <span className="badge warn">{t('rescue.offerPct', { pct: pctText(c.bp) })}</span>
      </div>
      <p className="text-xl font-bold mt-3 mb-1">{t('rescue.offerLine', { net: inr(c.netPaise), amount: inr(c.outPaise), payBy: fmtDate(c.payBy) })}</p>
      <ul className="m-0 pl-5 hint">
        <li>{t('rescue.offerCost', { amount: inr(c.discountPaise) })} · {t('rescue.offerBorrow', { amount: inr(c.borrowCostPaise) })}</li>
        <li>{t('rescue.offerYield', { pct: c.customerYieldPct })}</li>
      </ul>
      {o && ['sent', 'accepted', 'declined', 'used'].includes(o.status) ? (
        <p className="mt-3 mb-0"><span className={`badge ${o.status === 'accepted' ? 'ok' : o.status === 'declined' ? 'bad' : 'info'}`}>
          {o.status === 'accepted' ? t('rescue.status_accepted', { date: fmtDate(o.promisedOn) }) : o.status === 'sent' ? t('rescue.status_sent', { date: fmtDate(o.sentOn) }) : t('rescue.status_' + o.status)}
        </span></p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn" onClick={() => send('whatsapp')}>{t('rescue.sendWhatsapp')}</button>
          <button className="btn secondary" onClick={() => send('email')}>{t('rescue.sendEmail')}</button>
        </div>
      )}
    </article>
  )
}

export default function Rescue() {
  const { db, today, t } = useApp()
  const plan = buildRescue(db, today)
  const inPlay = db.invoices.filter((i) => i.offer && ['sent', 'accepted', 'declined', 'used'].includes(i.offer.status))
  const committed = inPlay.filter((i) => i.offer.status === 'accepted').reduce((a, i) => a + i.offer.netPaise, 0)

  return (
    <>
      <div className="kicker">{t('rescue.kicker')}</div>

      {!plan.needed ? (
        <>
          <h1 className="display text-5xl sm:text-7xl mt-2 mb-4">{inPlay.some((i) => i.offer.status === 'accepted') ? t('rescue.closedByOffers') : t('rescue.none')}</h1>
          {committed > 0 && <p className="text-xl font-bold">{t('rescue.committed', { amount: inr(committed) })}</p>}
        </>
      ) : (
        <>
          <h1 className="display text-5xl sm:text-7xl mt-2 mb-3">
            {t('rescue.headlineA')} <span className="text-[var(--bad)]">{inr(plan.base.shortfall)}</span> {t('rescue.headlineB', { week: plan.base.firstBelow.index + 1 })}
          </h1>
          <p className="text-xl max-w-2xl mt-0">{t('rescue.sub')}</p>

          <div className="grid grid-cols-2 border-[3px] border-[var(--rule)] my-5">
            <div className="p-4 border-r-[3px] border-[var(--rule)]">
              <div className="kicker">{t('rescue.lowestBefore')}</div>
              <div className="num-hero !text-5xl sm:!text-7xl text-[var(--bad)]">{inrShort(plan.base.lowest.closing)}</div>
              <div className="hint money">{inr(plan.base.lowest.closing)}</div>
            </div>
            <div className={`p-4 ${plan.closed ? 'bg-[var(--hi)]' : ''}`}>
              <div className="kicker !text-[var(--ink)]">{t('rescue.lowestAfter')}</div>
              <div className="num-hero !text-5xl sm:!text-7xl">{inrShort(plan.final.lowest.closing)}</div>
              <div className="hint money !text-[var(--ink)]">{inr(plan.final.lowest.closing)}</div>
            </div>
          </div>
          <p className={`font-bold ${plan.closed ? '' : 'err'}`}>{plan.closed ? '✓ ' + t('rescue.closedYes', { buffer: inr(plan.base.buffer) }) : t('rescue.closedNo')}</p>

          <ol className="list-none p-0 m-0">
            {plan.supplier && (
              <Step n="1" title={t('rescue.stepSupplier', { days: plan.supplier.days })}>
                <p className="mt-2 mb-0">{t('rescue.supplierBody', { n: plan.supplier.bills, days: plan.supplier.days, gain: inr(plan.supplier.gainPaise), cost: inr(plan.supplier.costPaise) })}</p>
              </Step>
            )}
            {plan.offers.length > 0 && (
              <Step n={plan.supplier ? '2' : '1'} title={t('rescue.stepOffers')}>
                <p className="mt-2 mb-0">{t('rescue.offersBody')}</p>
                {plan.offers.map((c) => <OfferCard key={c.invoiceId} c={c} />)}
              </Step>
            )}
            {plan.overdraft && (
              <Step n={String((plan.supplier ? 1 : 0) + (plan.offers.length ? 1 : 0) + 1)} title={t('rescue.stepBorrow')}>
                <p className="mt-2 mb-0">{t('rescue.borrowBody', { amount: inr(plan.overdraft.amountPaise), date: fmtDate(plan.overdraft.from), days: plan.overdraft.days, apr: CONFIG.overdraftAprPct, cost: inr(plan.overdraft.costPaise) })}</p>
              </Step>
            )}
          </ol>

          <section className="card mt-4" aria-labelledby="cost">
            <h2 id="cost" className="text-2xl m-0">{t('rescue.totals')}</h2>
            <div className="grid sm:grid-cols-3 gap-4 mt-3">
              <div><div className="kicker">{t('rescue.planCost')}</div><div className="num-hero !text-4xl">{inr(plan.totalCost)}</div></div>
              <div><div className="kicker">{t('rescue.borrowAll', { amount: inr(plan.borrowAll.amountPaise) })}</div><div className="num-hero !text-4xl text-[var(--muted)]">{inr(plan.borrowAll.costPaise)}</div></div>
              <div><div className="kicker">{plan.savingsPaise > 0 ? t('rescue.save', { amount: '' }) : t('rescue.saveNone')}</div>{plan.savingsPaise > 0 && <div className="num-hero !text-4xl"><span className="hl">{inr(plan.savingsPaise)}</span></div>}</div>
            </div>
            <p className="hint mb-0 mt-3">{t('rescue.dependsOn', { amount: inr(plan.borrowAll.costPaise) })}</p>
          </section>
        </>
      )}

      {inPlay.length > 0 && (
        <section className="mt-8" aria-labelledby="play">
          <h2 id="play" className="text-2xl border-t-[3px] border-[var(--rule)] pt-3">{t('rescue.inPlay')}</h2>
          {committed > 0 && <p className="font-bold">{t('rescue.committed', { amount: inr(committed) })}</p>}
          <ul className="list-none p-0 m-0 grid gap-2">
            {inPlay.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 border-b border-[var(--line)] pb-2">
                <span><Link to={`/invoices/${i.id}`} className="font-bold">{i.number}</Link> · {custOf(db, i).name}</span>
                <span className="badge info">{i.offer.status === 'accepted' ? t('rescue.status_accepted', { date: fmtDate(i.offer.promisedOn) }) : i.offer.status === 'sent' ? t('rescue.status_sent', { date: fmtDate(i.offer.sentOn) }) : t('rescue.status_' + i.offer.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!plan.needed && inPlay.length === 0 && <Empty>{t('rescue.none')}</Empty>}

      <details className="mt-8 border-t-[3px] border-[var(--rule)] pt-3">
        <summary className="font-bold cursor-pointer min-h-[48px] flex items-center">{t('rescue.assumptions')}</summary>
        <p className="hint">{t('rescue.assumptionsBody', { apr: CONFIG.overdraftAprPct, fee: CONFIG.supplierDelayFeePctPerMonth, days: CONFIG.supplierDelayDays })}</p>
        <p className="hint">{t('rescue.how')}</p>
      </details>
    </>
  )
}
