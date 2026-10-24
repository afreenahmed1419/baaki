// Run: node scripts/check-i18n.mjs — every key used in code exists in both languages, and en/hi match.
import fs from 'node:fs'
import path from 'node:path'
import en from '../src/i18n/en.js'
import hi from '../src/i18n/hi.js'

const files = []
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f.name) && files.push(p) } }
walk('src')
const used = new Set()
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/\bt\('([A-Za-z_.0-9]+)'/g)) used.add(m[1])
  for (const m of s.matchAll(/'(nav\.[a-z]+)'/g)) used.add(m[1])
}
// dynamic keys: prefix -> values
const DYN = {
  'status.': ['draft', 'sent', 'due_soon', 'overdue', 'part_paid', 'paid', 'disputed'],
  'stage.': ['heads_up', 'reminder', 'firm', 'final', 'demand', 'next_steps'],
  'channel.': ['whatsapp', 'email', 'sms', 'manual'],
  'pause.': ['dispute', 'claim', 'promise'],
  'age.': ['not_due', 'd1_30', 'd31_60', 'd61_90', 'd90'],
  'doc.': ['tax_invoice', 'bill_of_supply', 'invoice'],
  'ev.': ['created', 'sent', 'reminder', 'letter', 'advice', 'payment', 'dispute', 'claim', 'promise', 'note', 'resolved', 'offer', 'offer_accepted', 'offer_declined'],
  'flag.': ['exact', 'part_payment', 'multi_invoice', 'overpayment', 'unmatched', 'possible_tds', 'duplicate', 'early_discount'],
  'why.': ['discount_offer', 'invoice_number_found', 'customer_name_found', 'amount_exact', 'covers_several', 'more_than_due', 'less_than_due', 'tds_1', 'tds_2', 'tds_10', 'already_imported', 'no_open_invoice', 'nothing_found'],
  'fc.': ['bigOrder', 'bigOrderCost', 'reason_dispute', 'reason_very_late'],
  'inbox.': ['accepted', 'rejected'],
  'cust.reason_': ['A', 'B', 'C'],
  'err.gstin_': ['length', 'pattern', 'state', 'checkdigit'],
  'settings.reg_': ['regular', 'composition', 'unregistered'],
  'settings.cat_': ['micro', 'small', 'medium'],
  'settings.size_': ['normal', 'large', 'xlarge'],
  'rescue.status_': ['declined', 'withdrawn', 'used'],
  'voice.err_': ['not-allowed', 'no-speech', 'other'],
  'new.noGstNote_': ['bill_of_supply', 'invoice'],
  'scan.err_': ['not_configured', 'unsupported_type', 'too_large', 'pdf_too_large', 'network', 'unreadable', 'ai_failed'],
}
used.delete('fc.reason_'); used.delete('rescue.status_'); used.delete('voice.err_'); used.delete('scan.err_'); for (const [p, vs] of Object.entries(DYN)) { used.delete(p); for (const v of vs) used.add(p + v) }
const bad = [...used].filter((k) => !(k in en) || !(k in hi))
const onlyEn = Object.keys(en).filter((k) => !(k in hi))
const onlyHi = Object.keys(hi).filter((k) => !(k in en))
// placeholders must match
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',')
const phBad = Object.keys(en).filter((k) => hi[k] && ph(en[k]) !== ph(hi[k]))
const unused = Object.keys(en).filter((k) => !used.has(k))
console.log({ keys: Object.keys(en).length, missingInEitherLang: bad, onlyEn, onlyHi, placeholderMismatch: phBad })
console.log('unused keys (informational):', unused.join(' '))
process.exit(bad.length || onlyEn.length || onlyHi.length || phBad.length ? 1 : 0)
