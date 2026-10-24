// Voice and typed commands in Hindi, Hinglish and English. Rule-based on purpose: it works offline,
// needs no AI key, and never acts on its own. Payments only become real after the owner confirms.
import { forecast, outstandingOf, isOpen, priorityList, summary, daysOverdue } from './ledger.js'
import { matchRows } from './matching.js'

// ---- text helpers ---------------------------------------------------------------
const MARKS = /[़ा-्ँ-ः]/g // nukta, matras, halant, anusvara, chandrabindu, visarga
const norm = (s) => s.toLowerCase().replace(/[.,!?;:()"'₹]/g, ' ').replace(/\s+/g, ' ').trim()
const skeleton = (s) => norm(s).replace(MARKS, '')

function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return dp[a.length][b.length]
}
const similar = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1)

// ---- customers -----------------------------------------------------------------
const GENERIC = new Set(['foods', 'pvt', 'ltd', 'co', 'industries', 'traders', 'ji', 'the', 'and', 'ka', 'ki', 'ke', 'ko', 'ne', 'se'])

export function findCustomer(db, text) {
  const words = [...new Set([...norm(text).split(' '), ...skeleton(text).split(' ')])].filter((w) => w.length > 1)
  let best = null
  for (const c of db.customers) {
    const names = [c.name, c.contact, ...(c.aliases || [])]
    let score = 0
    for (const n of names) {
      for (const tok of norm(n).split(' ').concat(skeleton(n).split(' '))) {
        if (tok.length < 2 || GENERIC.has(tok)) continue
        if (words.some((w) => similar(w, tok))) score += tok.length >= 5 ? 2 : 1
      }
      // whole alias spoken as a phrase
      if (norm(text).includes(norm(n)) && norm(n).length > 3) score += 3
    }
    if (score > 0 && (!best || score > best.score)) best = { customer: c, score }
  }
  return best && best.score >= 2 ? best.customer : null
}

// ---- amounts ---------------------------------------------------------------------
const SMALL = {
  ek: 1, एक: 1, do: 2, दो: 2, teen: 3, तीन: 3, char: 4, chaar: 4, चार: 4, panch: 5, paanch: 5, पाँच: 5, पांच: 5, chhe: 6, छह: 6, छः: 6,
  saat: 7, सात: 7, aath: 8, आठ: 8, nau: 9, नौ: 9, das: 10, दस: 10, bees: 20, बीस: 20, tees: 30, तीस: 30, chalis: 40, चालीस: 40,
  pachas: 50, पचास: 50, saath: 60, साठ: 60, sattar: 70, सत्तर: 70, assi: 80, अस्सी: 80, nabbe: 90, नब्बे: 90,
}
const FRACTION = { dedh: 1.5, डेढ़: 1.5, डेढ: 1.5, dhai: 2.5, ढाई: 2.5, sava: 1.25, सवा: 1.25, paun: 0.75, पौन: 0.75, aadha: 0.5, आधा: 0.5 }
const MULT = {
  sau: 100, सौ: 100, hundred: 100, hazaar: 1000, hazar: 1000, hajar: 1000, हज़ार: 1000, हजार: 1000, thousand: 1000, k: 1000,
  lakh: 100000, lac: 100000, lakhs: 100000, लाख: 100000, crore: 10000000, करोड़: 10000000, karod: 10000000,
}

// Returns rupees (a whole number) or null. Digits like "50,000" or "2.5 lakh", and common spoken words.
export function parseAmountRupees(text) {
  // keep the digits intact first ("50,000" and "2.5" must survive), then clean the rest
  const kept = String(text).toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/(\d)\.(?=\d)/g, '$1<dot>')
  const toks = norm(kept).replace(/<dot>/g, '.').replace(/(\d)([a-zऀ-ॿ])/g, '$1 $2').split(' ')
  let total = 0, cur = 0, seen = false
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i]
    if (/^\d+(\.\d+)?$/.test(w)) { cur += parseFloat(w); seen = true; continue }
    if (w in FRACTION) { cur += FRACTION[w]; seen = true; continue }
    if (w in SMALL) { cur += SMALL[w]; seen = true; continue }
    if (w in MULT) {
      if (!seen && cur === 0) continue
      if (MULT[w] === 100) cur = (cur || 1) * 100
      else { total += (cur || 1) * MULT[w]; cur = 0 }
      seen = true
    }
  }
  total += cur
  return seen && total > 0 ? Math.round(total) : null
}

// ---- intents -----------------------------------------------------------------------
const has = (t, words) => words.some((w) => t.includes(w))
const PAID_WORDS = ['diye', 'diya', 'diyee', 'दिए', 'दिया', 'दिये', 'दी ', 'bheje', 'bheja', 'भेजे', 'भेजा', 'aaye', 'aaya', 'आए', 'आया', 'mile', 'mila', 'मिले', 'मिला', 'jama', 'जमा', 'paid', 'received', 'payment', 'pay kiya', 'भुगतान किया', 'chuka', 'चुका', 'transfer']
const CHASE_WORDS = ['kisko', 'किसको', 'किसे', 'kise', 'kiski', 'किसकी', 'who', 'whom', 'which customer']
const ACTION_WORDS = ['phone', 'फ़ोन', 'फोन', 'call', 'chase', 'follow', 'vasool', 'वसूल', 'yaad', 'याद', 'reminder', 'पहले', 'pehle', 'first', 'zyada', 'ज़्यादा', 'zaroori', 'ज़रूरी']
const OWED_WORDS = ['baaki', 'baki', 'बाकी', 'udhar', 'उधार', 'owed', 'owe', 'lena', 'लेना', 'pending', 'बकाया', 'outstanding', 'dena']
const HOWMUCH = ['kitna', 'kitni', 'कितना', 'कितनी', 'how much', 'total']
const OVERDUE_WORDS = ['overdue', 'late', 'देर', 'der se', 'bakaya', 'बकाया', 'lete']
const CASH_WORDS = ['cash', 'nakad', 'नकद', 'नकदी', 'gap', 'kami', 'कमी', 'short', 'forecast', 'अनुमान', 'paisa kam', 'पैसा कम', 'kab']
const RESCUE_WORDS = ['rescue', 'bachao', 'बचाओ', 'plan', 'upay', 'उपाय', 'fix', 'discount', 'छूट', 'chhoot', 'offer']
const REMIND_WORDS = ['reminder', 'याद', 'yaad', 'bhejo', 'भेजो', 'message', 'संदेश', 'whatsapp', 'व्हाट्सऐप']

export function parseCommand(db, raw, today) {
  const text = norm(raw)
  if (!text) return { intent: 'empty' }
  const customer = findCustomer(db, raw)
  const rupees = parseAmountRupees(raw)

  // 1. record a payment: needs who and how much
  if (has(text, PAID_WORDS.map((w) => w.trim())) && (rupees || customer)) {
    if (!customer) return { intent: 'payment_missing', missing: 'customer', rupees }
    if (!rupees) return { intent: 'payment_missing', missing: 'amount', customer }
    const amountPaise = rupees * 100
    const rows = [{ date: today, description: `VOICE ${customer.name}`, debitPaise: 0, creditPaise: amountPaise, reference: `voice-${today}-${amountPaise}` }]
    const [match] = matchRows({ ...db, importedKeys: [] }, rows, today)
    return { intent: 'payment', customer, amountPaise, match }
  }

  // 2. who should I chase
  if (has(text, CHASE_WORDS) && (has(text, ACTION_WORDS) || !has(text, OWED_WORDS))) {
    const fc = forecast(db, today)
    const top = priorityList(db, today, fc).slice(0, 3)
    return { intent: 'chase', top }
  }

  // 3. how much is owed / overdue (everyone, or one customer)
  if (has(text, HOWMUCH) && has(text, OWED_WORDS.concat(OVERDUE_WORDS))) {
    if (customer) {
      const open = db.invoices.filter((i) => i.customerId === customer.id && isOpen(db, i))
      const owed = open.reduce((a, i) => a + outstandingOf(db, i), 0)
      const overdue = open.filter((i) => daysOverdue(i, today) > 0).reduce((a, i) => a + outstandingOf(db, i), 0)
      return { intent: 'customer_owed', customer, owedPaise: owed, overduePaise: overdue, count: open.length }
    }
    const s = summary(db, today)
    return { intent: has(text, OVERDUE_WORDS) ? 'overdue' : 'owed', owedPaise: s.toCollect, overduePaise: s.overdue, count: s.openCount, overdueCount: s.overdueCount }
  }
  if (customer && has(text, OWED_WORDS)) {
    const open = db.invoices.filter((i) => i.customerId === customer.id && isOpen(db, i))
    return { intent: 'customer_owed', customer, owedPaise: open.reduce((a, i) => a + outstandingOf(db, i), 0), overduePaise: open.filter((i) => daysOverdue(i, today) > 0).reduce((a, i) => a + outstandingOf(db, i), 0), count: open.length }
  }

  // 4. rescue plan / reminders / cash
  if (has(text, RESCUE_WORDS)) return { intent: 'rescue' }
  if (customer && has(text, REMIND_WORDS)) return { intent: 'reminder', customer }
  if (has(text, CASH_WORDS)) {
    const fc = forecast(db, today)
    return { intent: 'cash', fc }
  }
  return { intent: 'unknown' }
}

export const EXAMPLES = {
  hi: ['पाटिल ने 50000 दिए', 'आज किसको फ़ोन करूँ?', 'कुल कितना बाकी है?', 'शिंदे का कितना बाकी है?', 'नकदी कब कम पड़ेगी?'],
  en: ['Patil paid 50000', 'Who should I chase today?', 'How much is overdue?', 'How much does Shinde owe?', 'When will cash run short?'],
}
