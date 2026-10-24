import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store.jsx'
import { EXAMPLES, parseCommand } from '../lib/voice.js'
import { invOf } from '../lib/ledger.js'
import { inr } from '../lib/money.js'

const getSR = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null)

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" /><path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" />
    </svg>
  )
}

// Floating "speak to Baaki" button and panel. Understands Hindi, Hinglish and English.
// Nothing changes until the owner presses Confirm.
export default function VoiceDock() {
  const { db, today, lang, t, confirmMatch } = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')
  const [speak, setSpeak] = useState(true)
  const [recLangPick, setRecLang] = useState(null) // null = follow the app language
  const recLang = recLangPick ?? (lang === 'hi' ? 'hi-IN' : 'en-IN')
  const rec = useRef(null)
  const SR = getSR()

  useEffect(() => () => { try { rec.current?.abort() } catch { /* ignore */ } }, [])

  // spoken answers
  const say = (s) => {
    if (!speak || typeof window === 'undefined' || !window.speechSynthesis || !s) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(s)
      u.lang = recLang
      window.speechSynthesis.speak(u)
    } catch { /* ignore */ }
  }

  // turn a parsed command into text lines the owner can read (and hear)
  const lines = (r) => {
    switch (r.intent) {
      case 'payment': {
        const m = r.match
        if (!m.allocations.length) return [t('voice.res_noOpen', { customer: r.customer.name })]
        return [
          t('voice.res_payment', { amount: inr(r.amountPaise), customer: r.customer.name }),
          ...m.allocations.map((a) => t('voice.res_alloc', { invoice: invOf(db, a.invoiceId).number, amount: inr(a.amountPaise) })),
          ...(m.excessPaise > 0 ? [t('voice.res_excess', { amount: inr(m.excessPaise) })] : []),
          ...m.flags.filter((f) => ['part_payment', 'possible_tds', 'early_discount'].includes(f)).map((f) => t('flag.' + f)),
        ]
      }
      case 'payment_missing':
        return [r.missing === 'customer' ? t('voice.missing_customer', { amount: r.rupees ? inr(r.rupees * 100) : '50000' }) : t('voice.missing_amount', { customer: r.customer.name })]
      case 'chase':
        return r.top.length
          ? [t('voice.res_chase'), ...r.top.map((x, i) => t('voice.res_chaseLine', { n: i + 1, customer: x.cust.name, amount: inr(x.out), days: x.od }))]
          : [t('voice.res_none')]
      case 'owed': return [t('voice.res_owed', { amount: inr(r.owedPaise), n: r.count, overdue: inr(r.overduePaise) })]
      case 'overdue': return [t('voice.res_overdue', { overdue: inr(r.overduePaise), n: r.overdueCount })]
      case 'customer_owed': return [t('voice.res_customer', { customer: r.customer.name, amount: inr(r.owedPaise), n: r.count, overdue: inr(r.overduePaise) })]
      case 'cash':
        return [r.fc.firstBelow
          ? t('voice.res_cashShort', { week: r.fc.firstBelow.index + 1, amount: inr(r.fc.shortfall) })
          : t('voice.res_cashOk', { amount: inr(r.fc.lowest.closing) })]
      case 'rescue': return [t('voice.res_rescue')]
      case 'reminder': return [t('voice.res_reminder', { customer: r.customer.name })]
      default: return [t('voice.res_unknown')]
    }
  }

  const run = (input) => {
    const q = (input ?? text).trim()
    if (!q) return
    setText(q)
    const r = parseCommand(db, q, today)
    setResult(r)
    say(lines(r).join('. '))
  }

  const listen = () => {
    if (!SR) return
    if (listening) { try { rec.current?.stop() } catch { /* ignore */ } return }
    setErr(''); setResult(null)
    const r = new SR()
    rec.current = r
    r.lang = recLang
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    let finalText = ''
    r.onresult = (e) => {
      const s = Array.from(e.results).map((x) => x[0].transcript).join(' ')
      setText(s)
      if (e.results[e.results.length - 1].isFinal) finalText = s
    }
    r.onerror = (e) => setErr(e.error === 'not-allowed' ? 'not-allowed' : e.error === 'no-speech' ? 'no-speech' : 'other')
    r.onend = () => { setListening(false); if (finalText) run(finalText) }
    try { r.start(); setListening(true) } catch { setErr('other') }
  }

  const close = () => { setOpen(false); setListening(false); try { rec.current?.abort() } catch { /* ignore */ } try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }
  const ex = EXAMPLES[lang === 'hi' ? 'hi' : 'en']
  const canConfirm = result?.intent === 'payment' && result.match.allocations.length > 0

  return (
    <>
      <button className="no-print fixed z-40 right-3 bottom-4 md:bottom-6 md:right-6 flex items-center gap-2 min-h-[56px] px-4 border-2 border-[var(--ink)] bg-[var(--bad)] text-white font-extrabold cursor-pointer hover:bg-[var(--ink)]"
        onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={t('voice.open')}>
        <MicIcon /><span className="hidden sm:inline">{t('voice.open')}</span>
      </button>

      {open && (
        <div className="no-print fixed z-50 inset-x-0 bottom-0 md:inset-x-auto md:right-6 md:bottom-24 md:w-[27rem] max-h-[85vh] overflow-y-auto bg-[var(--bg)] border-t-[3px] md:border-[3px] border-[var(--ink)]"
          role="dialog" aria-modal="false" aria-label={t('voice.title')}>
          <div className="flex items-start justify-between gap-2 p-4 border-b-[3px] border-[var(--ink)]">
            <div>
              <div className="kicker">{t('voice.sub')}</div>
              <h2 className="display text-3xl m-0">{t('voice.title')}</h2>
            </div>
            <button className="btn secondary small" onClick={close} aria-label={t('voice.close')}>✕</button>
          </div>

          <div className="p-4 grid gap-3">
            {SR ? (
              <div className="flex items-center gap-3">
                <button className={`btn ${listening ? 'danger mic-live' : ''} !min-h-[64px] !min-w-[64px]`} onClick={listen} aria-pressed={listening} aria-label={listening ? t('voice.stop') : t('voice.listen')}>
                  <MicIcon />
                </button>
                <div className="flex-1">
                  <div className="font-bold">{listening ? t('voice.listening') : t('voice.listen')}</div>
                  <label className="kicker flex items-center gap-2">{t('voice.recLang')}
                    <select className="input !min-h-[40px] !py-1 !w-auto" value={recLang} onChange={(e) => setRecLang(e.target.value)} aria-label={t('voice.recLang')}>
                      <option value="hi-IN">हिंदी</option><option value="en-IN">English</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : <p className="hint m-0">{t('voice.unsupported')}</p>}
            {err && <p className="err m-0" role="alert">{t('voice.err_' + err)}</p>}

            <form onSubmit={(e) => { e.preventDefault(); run() }} className="flex gap-2">
              <label className="sr-only" htmlFor="voice-q">{t('voice.placeholder')}</label>
              <input id="voice-q" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('voice.placeholder')} lang={lang === 'hi' ? 'hi' : 'en'} />
              <button className="btn shrink-0 whitespace-nowrap" type="submit">{t('voice.go')}</button>
            </form>

            <div aria-live="polite">
              {result && (
                <div className="card">
                  {lines(result).map((l, i) => <p key={i} className={`m-0 ${i === 0 ? 'font-bold' : ''} ${i > 0 ? 'mt-1' : ''}`}>{l}</p>)}
                  {result.intent === 'unknown' && <ul className="mt-2 mb-0 pl-5">{ex.map((e) => <li key={e}>{e}</li>)}</ul>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {canConfirm && (
                      <>
                        <button className="btn" onClick={() => { confirmMatch(result.match); setResult({ intent: 'done' }); say(t('voice.done')) }}>{t('voice.confirm')}</button>
                        <button className="btn secondary" onClick={() => setResult(null)}>{t('voice.cancel')}</button>
                      </>
                    )}
                    {result.intent === 'rescue' && <button className="btn" onClick={() => { nav('/rescue'); close() }}>{t('voice.open_rescue')}</button>}
                    {result.intent === 'cash' && result.fc.firstBelow && <button className="btn" onClick={() => { nav('/rescue'); close() }}>{t('voice.open_rescue')}</button>}
                    {result.intent === 'reminder' && <button className="btn" onClick={() => { nav('/followups'); close() }}>{t('voice.open_followups')}</button>}
                    {result.intent === 'chase' && <button className="btn secondary" onClick={() => { nav('/chase'); close() }}>{t('nav.chase')}</button>}
                  </div>
                </div>
              )}
              {result?.intent === 'done' && <div className="card"><p className="m-0 font-bold">{t('voice.done')}</p></div>}
            </div>

            <div>
              <div className="kicker mb-1">{t('voice.try')}</div>
              <div className="flex flex-wrap gap-2">
                {ex.map((e) => <button key={e} className="btn ghost small" onClick={() => run(e)}>{e}</button>)}
              </div>
            </div>
            <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={speak} onChange={(e) => setSpeak(e.target.checked)} />{t('voice.readAloud')}</label>
          </div>
        </div>
      )}
    </>
  )
}
