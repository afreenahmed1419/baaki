import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { coverGap, forecast, followUps, priorityList, summary } from '../lib/ledger.js'
import { inr, inrShort } from '../lib/money.js'
import { fmtDate } from '../lib/dates.js'
import { GradeBadge, Money, Term } from '../components/ui.jsx'

// segments use fill + pattern + a number so colour is never the only signal
const BUCKETS = [
  ['not_due', '#0e0e0c', 'none'],
  ['d1_30', '#f7d53a', 'none'],
  ['d31_60', '#e0701a', 'none'],
  ['d61_90', '#b81d06', 'none'],
  ['d90', '#5c0f04', 'url(#hatch)'],
]

function Stat({ label, value, sub, tone }) {
  return (
    <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-[var(--rule)] last:border-0">
      <div className="kicker">{label}</div>
      <div className={`display text-4xl mt-1 money !font-black ${tone === 'bad' ? 'text-[var(--bad)]' : ''}`} style={{ fontFamily: 'var(--f-display)', letterSpacing: '-0.04em' }}>{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { db, today, t } = useApp()
  const s = summary(db, today)
  const fc = forecast(db, today)
  const top = priorityList(db, today, fc).slice(0, 5)
  const nFollow = followUps(db, today).length
  const gap = coverGap(db, today, fc)
  const total = Object.values(s.buckets).reduce((a, b) => a + b, 0) || 1
  const name = db.business.owner.split(' ')[0]

  return (
    <>
      <div className="kicker">{fmtDate(today)} · {db.business.name}</div>
      <h1 className="text-2xl sm:text-3xl mt-1 mb-5">{t('dash.title', { name })}</h1>

      {fc.firstBelow ? (
        <section className="card mb-6 !border-l-[10px] !border-l-[var(--bad)]" aria-labelledby="warn">
          <span className="badge bad">{t('dash.warnKicker')}</span>
          <h2 id="warn" className="text-2xl sm:text-3xl mt-2 mb-1">
            {t('dash.shortBy')} <span className="text-[var(--bad)]">{inrShort(fc.shortfall)}</span> {t('dash.inWeek', { week: fc.firstBelow.index + 1 })}
          </h2>
          <p className="mt-0 mb-3 max-w-2xl">
            {t('dash.warnBody2', { date: fmtDate(fc.firstBelow.start), n: gap.picks.length })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/rescue" className="btn">{t('dash.fixThis')} →</Link>
            <Link to="/forecast" className="btn secondary">{t('dash.seeForecast')}</Link>
          </div>
        </section>
      ) : (
        <section className="card mb-6 !bg-[var(--hi)]"><p className="m-0 font-bold text-lg">{t('dash.allClear')}</p></section>
      )}

      <section className="grid sm:grid-cols-2 gap-6 mb-6 items-end" aria-label={t('dash.toCollect')}>
        <div>
          <div className="kicker"><Term tip={t('tip.receivables')}>{t('dash.owedHero')}</Term></div>
          <div className="num-hero">{inrShort(s.toCollect)}</div>
          <div className="hint mt-1"><Money p={s.toCollect} /> · {t('dash.invoicesCount', { n: s.openCount })}</div>
        </div>
        <div>
          <div className="kicker"><Term tip={t('tip.overdue')}>{t('dash.overdue')}</Term></div>
          <div className="num-hero text-[var(--bad)]">{inrShort(s.overdue)}</div>
          <div className="hint mt-1"><Money p={s.overdue} /> · {t('dash.invoicesCount', { n: s.overdueCount })}</div>
        </div>
      </section>

      <section className="mb-6" aria-labelledby="age">
        <h2 id="age" className="kicker !font-semibold border-t-[3px] border-[var(--rule)] pt-2 m-0 mb-2" style={{ fontFamily: 'var(--f-mono)', fontSize: '.78rem', letterSpacing: '.09em' }}>{t('dash.ageing')}</h2>
        <svg className="w-full h-12 border-2 border-[var(--ink)] block" viewBox="0 0 100 10" preserveAspectRatio="none" role="img"
          aria-label={BUCKETS.map(([k]) => `${t('age.' + k)} ${inr(s.buckets[k])}`).join(', ')}>
          <defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#5c0f04" /><line x1="0" y1="0" x2="0" y2="2" stroke="#fff" strokeWidth="0.7" /></pattern></defs>
          {BUCKETS.map(([k, c, f], i) => {
            const w = (s.buckets[k] / total) * 100
            const x = BUCKETS.slice(0, i).reduce((acc, [kk]) => acc + (s.buckets[kk] / total) * 100, 0)
            return w > 0 && <rect key={k} x={x} y="0" width={w} height="10" fill={f !== 'none' ? f : c} stroke="#f3efe6" strokeWidth="0.3" />
          })}
        </svg>
        <ul className="list-none p-0 m-0 mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {BUCKETS.map(([k, c]) => (
            <li key={k} className="border-t-4 pt-1" style={{ borderColor: c }}>
              <span className="kicker block">{t('age.' + k)}</span>
              <strong className="money">{inrShort(s.buckets[k])}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 border-[3px] border-[var(--rule)] mb-8" aria-label="Summary">
        <Stat label={t('dash.expectedWeek')} value={inrShort(s.expectedWeek)} />
        <Stat label={t('dash.expectedMonth')} value={inrShort(s.expectedMonth)} />
        <Stat label={t('dash.billsDue')} value={inrShort(s.billsDue30)} sub={t('dash.billsSub')} />
        <Stat label={t('dash.cash')} value={inrShort(db.business.cashPaise)} sub={t('dash.lowest', { amount: inr(fc.lowest.closing), week: fc.lowest.index + 1 })} tone={fc.lowest.closing < 0 ? 'bad' : undefined} />
      </section>

      <section aria-labelledby="top">
        <div className="flex flex-wrap justify-between items-end gap-2 border-t-[3px] border-[var(--rule)] pt-3">
          <h2 id="top" className="text-3xl sm:text-4xl m-0">{t('dash.chaseFirst')}</h2>
          <div className="flex gap-2">
            <Link className="btn secondary small" to="/followups">{t('dash.todayFollowups', { n: nFollow })}</Link>
            <Link className="btn secondary small" to="/chase">{t('dash.seeAll')}</Link>
          </div>
        </div>
        <ol className="list-none p-0 mt-2 mb-0">
          {top.map((r, i) => (
            <li key={r.inv.id} className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[3.5rem_1fr_auto] gap-3 items-start py-3 border-b border-[var(--line)]">
              <span className="display text-4xl sm:text-5xl text-[var(--bad)]">{i + 1}</span>
              <div className="min-w-0">
                <div className="font-bold text-lg">{r.cust.name} <GradeBadge grade={r.grade} /></div>
                <div className="hint">{r.inv.number} · {t('chase.overdueDays', { n: r.od })}</div>
              </div>
              <Money p={r.out} className="font-bold text-lg" />
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
