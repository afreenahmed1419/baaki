import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { forecast, priorityList } from '../lib/ledger.js'
import { inr } from '../lib/money.js'
import { Empty, GradeBadge, Money, PageTitle } from '../components/ui.jsx'

// The reason, in words, from the facts behind the score.
export function reasonText(t, r) {
  const parts = [
    t('chase.r_amount', { amount: inr(r.out) }),
    t('chase.overdueDays', { n: r.od }),
    r.avgLate > 0 ? t('chase.r_usually', { n: r.avgLate }) : t('chase.r_ontime'),
  ]
  if (r.coversGap) parts.push(t('chase.r_gap', { week: r.gapWeek }))
  return parts.join(', ')
}

export default function Chase() {
  const { db, today, t } = useApp()
  const fc = forecast(db, today)
  const rows = priorityList(db, today, fc)
  return (
    <>
      <PageTitle title={t('nav.chase')} sub={t('chase.sub')} />
      {rows.length === 0 ? <Empty>{t('chase.none')}</Empty> : (
        <ol className="list-none p-0 m-0 border-b-[3px] border-[var(--rule)]">
          {rows.map((r, i) => (
            <li key={r.inv.id} className="grid grid-cols-[2.6rem_minmax(0,1fr)_auto] sm:grid-cols-[4rem_minmax(0,1fr)_auto] gap-3 items-start py-4 border-t-[3px] border-[var(--rule)]">
              <div>
                <div className="display text-4xl sm:text-5xl text-[var(--bad)]">{i + 1}</div>
                <div className="kicker" aria-label={t('chase.score')}>{r.score}/100</div>
              </div>
              <div className="min-w-0">
                <div className="font-bold text-lg">{r.cust.name} <GradeBadge grade={r.grade} /> {r.paused && <span className="badge warn">{t('pause.' + r.paused)}</span>}</div>
                <div className="hint"><Link to={`/invoices/${r.inv.id}`}>{r.inv.number}</Link></div>
                <p className="mt-1 mb-0">{reasonText(t, r)}.</p>
              </div>
              <Money p={r.out} className="font-extrabold text-lg" />
            </li>
          ))}
        </ol>
      )}
      <p className="hint mt-4">{t('chase.method')}</p>
    </>
  )
}
