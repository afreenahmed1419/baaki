import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useApp } from '../store.jsx'
import { inr } from '../lib/money.js'

const STATUS_TONE = { draft: 'neutral', paid: 'ok', disputed: 'warn', part_paid: 'info', overdue: 'bad', due_soon: 'warn', sent: 'info' }
export function StatusBadge({ status }) {
  const { t } = useApp()
  return <span className={`badge ${STATUS_TONE[status] || 'neutral'}`}>{t(`status.${status}`)}</span>
}

export function GradeBadge({ grade }) {
  const tone = { A: 'ok', B: 'warn', C: 'bad' }[grade]
  return <span className={`badge ${tone}`} aria-label={`Grade ${grade}`}>{grade}</span>
}

export const Money = ({ p, className = '' }) => <span className={`money ${className}`}>{inr(p)}</span>

export function PageTitle({ title, children, sub }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold m-0">{title}</h1>
        {sub && <p className="hint m-0">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Field({ label, hint, error, children, id, flag }) {
  const { t } = useApp()
  return (
    <div className="mb-3">
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <div className="hint mt-1">{hint}</div>}
      {error && <div className="err mt-1" role="alert">{error}</div>}
      {flag && <div className="mt-1 font-semibold text-[var(--warn)]">⚠ {t('scan.check')}</div>}
    </div>
  )
}

// Plain-language term with the accounting word in a tooltip.
export function Term({ children, tip }) {
  return <abbr title={tip} className="underline decoration-dotted cursor-help">{children}</abbr>
}

export function Empty({ children }) {
  return <div className="card hint text-center py-8">{children}</div>
}

export function Qr({ text, size = 120, label }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(text, { margin: 1, width: size * 2 }).then((u) => live && setSrc(u)).catch(() => {})
    return () => { live = false }
  }, [text, size])
  if (!src) return <div style={{ width: size, height: size }} aria-hidden="true" />
  return <img src={src} width={size} height={size} alt={label || 'QR code'} />
}

export const upiLink = (business, amountPaise, note) =>
  `upi://pay?pa=${encodeURIComponent(business.upi)}&pn=${encodeURIComponent(business.name)}&am=${(amountPaise / 100).toFixed(2)}&tn=${encodeURIComponent(note)}&cu=INR`

export function Confirm({ message, onYes, children, className = 'btn secondary small' }) {
  const { t } = useApp()
  const [ask, setAsk] = useState(false)
  if (!ask) return <button className={className} onClick={() => setAsk(true)}>{children}</button>
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="font-semibold">{message}</span>
      <button className="btn danger small" onClick={() => { setAsk(false); onYes() }}>{t('common.yes')}</button>
      <button className="btn ghost small" onClick={() => setAsk(false)}>{t('common.no')}</button>
    </span>
  )
}
