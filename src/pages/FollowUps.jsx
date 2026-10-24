import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { followUps, ladderOf, outstandingOf } from '../lib/ledger.js'
import { buildMessage, channelHref } from '../lib/messages.js'
import { addDays, fmtDate } from '../lib/dates.js'
import { Empty, Money, PageTitle } from '../components/ui.jsx'

function Group({ g }) {
  const { db, today, lang, t, markSent, snooze, promise } = useApp()
  const [mlang, setMlang] = useState(lang)
  const [text, setText] = useState(null)
  const [opened, setOpened] = useState(null)
  const [until, setUntil] = useState(addDays(today, 5))
  const m = buildMessage(db, g, mlang, today)
  const body = text ?? m.text
  const kind = g.stage.kind
  const ids = g.invoiceIds.join(',')

  const send = (channel) => {
    window.open(channelHref[channel](m.cust, body, m.subject), '_blank', 'noopener')
    setOpened(channel)
  }
  const done = (channel) => markSent(g, channel || opened || 'manual', body)

  return (
    <article className="card" aria-labelledby={`g-${g.key}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h2 id={`g-${g.key}`} className="text-lg font-bold m-0">{m.cust.name}</h2>
          <div className="hint">{m.cust.contact} · {m.cust.phone}</div>
        </div>
        <div className="text-right">
          <span className="badge warn">{t('stage.' + g.stage.id)}</span>
          <div className="font-extrabold text-xl money mt-1"><Money p={m.total} /></div>
        </div>
      </div>
      <ul className="m-0 mt-2 pl-5">
        {m.invs.map((i) => <li key={i.id}><Link to={`/invoices/${i.id}`}>{i.number}</Link> · {fmtDate(i.dueDate)} · <Money p={outstandingOf(db, i)} /></li>)}
      </ul>

      {kind === 'advice' ? (
        <div className="mt-3">
          <p className="font-semibold m-0">{t('fu.adviceTitle')}</p>
          <ul className="mt-1 mb-2">
            <li>{t('fu.adviceCall', { phone: m.cust.phone })}</li>
            <li>{t('fu.adviceLawyer')}</li>
            {db.business.udyam && <li>{t('fu.adviceMsme')}</li>}
          </ul>
          <p className="hint m-0">{t('fu.adviceNote')}</p>
          <button className="btn mt-2" onClick={() => done('manual')}>{t('fu.markDone')}</button>
        </div>
      ) : (
        <>
          {kind === 'letter' && (
            <div className="card !bg-[var(--warn-soft)] mt-3">
              <p className="m-0 mb-2">{t('fu.letterIntro')}</p>
              <Link className="btn" to={`/letter/${g.customerId}?inv=${ids}`}>{t('fu.openLetter')}</Link>
            </div>
          )}
          <div className="mt-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="label m-0" htmlFor={`m-${g.key}`}>{t('fu.message')}</label>
              <div role="group" aria-label={t('fu.msgLang')} className="flex border border-[var(--brand)] overflow-hidden">
                {[['en', 'English'], ['hi', 'हिंदी']].map(([c, n]) => (
                  <button key={c} aria-pressed={mlang === c} onClick={() => { setMlang(c); setText(null) }}
                    className={`min-h-[40px] px-3 font-semibold ${mlang === c ? 'bg-[var(--brand)] text-white' : 'bg-white text-[var(--brand)]'}`}>{n}</button>
                ))}
              </div>
            </div>
            {m.cust.lang !== mlang && <div className="hint">{t('fu.prefers', { lang: m.cust.lang === 'hi' ? 'हिंदी' : 'English' })}</div>}
            <textarea id={`m-${g.key}`} className="input mt-1" rows={6} value={body} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn" onClick={() => send('whatsapp')}>{t('channel.whatsapp')}</button>
            <button className="btn secondary" onClick={() => send('email')}>{t('channel.email')}</button>
            <button className="btn secondary" onClick={() => send('sms')}>{t('channel.sms')}</button>
          </div>
          {opened && <p className="hint mt-2">{t('fu.opened', { channel: t('channel.' + opened) })}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <button className={opened ? 'btn' : 'btn ghost'} onClick={() => done()}>{t('fu.markSent')}</button>
            <button className="btn ghost" onClick={() => snooze(g, 2)}>{t('fu.snooze')}</button>
          </div>
        </>
      )}

      <details className="mt-3">
        <summary className="font-semibold cursor-pointer min-h-[48px] flex items-center">{t('fu.promiseTitle')}</summary>
        <div className="flex flex-wrap items-end gap-3 mt-1">
          <div><label className="label" htmlFor={`pu-${g.key}`}>{t('fu.promiseDate')}</label><input id={`pu-${g.key}`} type="date" className="input" min={today} value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          <button className="btn secondary" onClick={() => promise(g.invoiceIds, until)}>{t('fu.promiseSave')}</button>
        </div>
        <p className="hint">{t('fu.promiseHint')}</p>
      </details>
    </article>
  )
}

export default function FollowUps() {
  const { db, today, t } = useApp()
  const groups = followUps(db, today)
  const steps = ladderOf(db)
  return (
    <>
      <PageTitle title={t('nav.followups')} sub={t('fu.sub', { n: groups.length })} />
      {groups.length === 0 ? <Empty>{t('fu.none')}</Empty> : <div className="grid gap-4">{groups.map((g) => <Group key={g.key} g={g} />)}</div>}
      <details className="card mt-6">
        <summary className="font-bold cursor-pointer min-h-[48px] flex items-center">{t('fu.ladderTitle')}</summary>
        <ol className="m-0 pl-5">{steps.map((s) => <li key={s.id}>{t('stage.' + s.id)}: {s.offset < 0 ? t('fu.before', { n: -s.offset }) : s.offset === 0 ? t('fu.onDue') : t('fu.after', { n: s.offset })}</li>)}</ol>
        <p className="hint">{t('fu.ladderNote')}</p>
      </details>
    </>
  )
}
