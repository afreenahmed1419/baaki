import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { followUps } from '../lib/ledger.js'
import { fmtDate } from '../lib/dates.js'
import VoiceDock from './VoiceDock.jsx'

const NAV = [
  ['/', 'nav.dashboard'],
  ['/followups', 'nav.followups'],
  ['/rescue', 'nav.rescue'],
  ['/invoices', 'nav.invoices'],
  ['/new', 'nav.new'],
  ['/customers', 'nav.customers'],
  ['/payments', 'nav.payments'],
  ['/forecast', 'nav.forecast'],
  ['/chase', 'nav.chase'],
  ['/inbox', 'nav.inbox'],
  ['/documents', 'nav.documents'],
  ['/settings', 'nav.settings'],
]
const BOTTOM = ['/', '/followups', '/rescue', '/invoices']

export default function Shell() {
  const { db, today, lang, t, setSettings } = useApp()
  const [open, setOpen] = useState(false)
  const nFollow = followUps(db, today).length
  const nInbox = db.inbox.filter((i) => i.status === 'open').length
  const badge = (to) => (to === '/followups' ? nFollow : to === '/inbox' ? nInbox : 0)
  const cls = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">{t('common.skip')}</a>

      <aside className="no-print hidden md:flex md:flex-col w-64 shrink-0 border-r-[3px] border-[var(--rule)] sticky top-0 h-screen overflow-y-auto">
        <div className="px-4 pt-5 pb-4 border-b-[3px] border-[var(--rule)]">
          <div className="display text-5xl">{t('app.name')}<span className="text-[var(--bad)]">.</span></div>
          <div className="kicker mt-2">{db.business.name}</div>
        </div>
        <nav aria-label="Main" className="py-2">
          {NAV.map(([to, key]) => (
            <NavLink key={to} to={to} end={to === '/'} className={cls}>
              <span className="flex-1">{t(key)}</span>
              {badge(to) > 0 && <span className="badge bad" aria-label={`${badge(to)}`}>{badge(to)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4 border-t border-[var(--line)] kicker">{t('common.today')}<br /><strong className="text-[var(--ink)]">{fmtDate(today)}</strong></div>
      </aside>

      <div className="flex-1 min-w-0 pb-24 md:pb-10">
        <div className="no-print sticky top-0 z-30 bg-[var(--bg)]">
        <header className="masthead flex items-center justify-between gap-2 px-4 py-2 max-md:!border-b">
          <div className="md:hidden display text-3xl">{t('app.name')}<span className="text-[var(--bad)]">.</span></div>
          <div className="hidden md:block kicker">{fmtDate(today)} · {db.business.name}</div>
          <div className="flex items-center gap-2">
            <span className="md:hidden kicker">{fmtDate(today)}</span>
            <div role="group" aria-label={t('settings.language')} className="flex border-2 border-[var(--ink)]">
              {[['en', 'EN'], ['hi', 'हि']].map(([code, name]) => (
                <button key={code} onClick={() => setSettings({ lang: code })} aria-pressed={lang === code} aria-label={code === 'en' ? 'English' : 'हिंदी'}
                  className={`min-h-[44px] min-w-[48px] px-3 font-extrabold border-0 cursor-pointer ${lang === code ? 'bg-[var(--ink)] text-[var(--brand-ink)]' : 'bg-transparent text-[var(--ink)]'}`}>{name}</button>
              ))}
            </div>
          </div>
        </header>
        <nav className="md:hidden grid grid-cols-5 border-b-[3px] border-[var(--rule)] bg-[var(--bg)]" aria-label="Main">
          {NAV.filter(([to]) => BOTTOM.includes(to)).map(([to, key]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center justify-center gap-1 text-center min-h-[52px] px-1 text-[0.8rem] leading-tight font-bold no-underline ${isActive ? 'bg-[var(--hi)] text-[var(--ink)]' : 'text-[var(--ink)]'}`}>
              {t(key)}
              {badge(to) > 0 && <span className="badge bad !py-0 !px-1.5 text-xs">{badge(to)}</span>}
            </NavLink>
          ))}
          <button onClick={() => setOpen(!open)} aria-expanded={open} className={`min-h-[52px] text-[0.8rem] font-bold border-0 cursor-pointer ${open ? 'bg-[var(--ink)] text-[var(--brand-ink)]' : 'bg-transparent text-[var(--ink)]'}`}>
            {t('nav.more')}
          </button>
        </nav>
        {open && (
          <div className="md:hidden absolute inset-x-0 top-full z-30 bg-[var(--bg)] border-b-[3px] border-[var(--rule)] p-2 grid grid-cols-2 gap-x-2">
            {NAV.filter(([to]) => !BOTTOM.includes(to)).map(([to, key]) => (
              <NavLink key={to} to={to} onClick={() => setOpen(false)} className={cls}>
                <span className="flex-1">{t(key)}</span>
                {badge(to) > 0 && <span className="badge bad">{badge(to)}</span>}
              </NavLink>
            ))}
          </div>
        )}
        </div>
        <main id="main" className="px-4 py-6 max-w-6xl mx-auto"><Outlet /></main>
      </div>

      <VoiceDock />

    </div>
  )
}
