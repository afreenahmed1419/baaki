// Run: node scripts/check-voice.mjs — spoken/typed commands in Hindi, Hinglish and English.
import { makeSeedDb } from '../src/data/index.js'
import { CONFIG } from '../src/config.js'
import { parseAmountRupees, parseCommand, findCustomer } from '../src/lib/voice.js'

let fails = 0
const ok = (n, c, x = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x) }
const db = makeSeedDb()
const today = CONFIG.demoToday

// amounts
const amt = (s, v) => ok(`amount "${s}" = ${v}`, parseAmountRupees(s) === v, String(parseAmountRupees(s)))
amt('50000', 50000); amt('50,000 rupees', 50000); amt('2 lakh', 200000); amt('2.5 lakh', 250000); amt('ढाई लाख', 250000)
amt('डेढ़ लाख', 150000); amt('पचास हज़ार', 50000); amt('pachas hazaar', 50000); amt('दो सौ', 200); amt('1 lakh 20 hazaar', 120000)
amt('बीस हज़ार', 20000); amt('sava lakh', 125000); amt('hello', null)

// customers (Latin and Devanagari, with spelling variants)
const who = (s, id) => ok(`customer "${s}" -> ${id}`, findCustomer(db, s)?.id === id, findCustomer(db, s)?.id)
who('Patil ne paise diye', 'c1'); who('पाटिल ने पैसे दिए', 'c1'); who('पाटील ने', 'c1'); who('shinde ka kitna baaki', 'c8'); who('शिंदे का', 'c8'); who('शिन्दे का', 'c8')
who('Bhosale Garments', 'c5'); who('कुलकर्णी', 'c4'); who('Mehta ji', 'c11'); who('Patel ne', 'c1')
ok('no customer in plain question', findCustomer(db, 'who should I chase today') === null)

// intents
const intent = (s, i, extra) => { const r = parseCommand(db, s, today); ok(`"${s}" -> ${i}`, r.intent === i && (!extra || extra(r)), JSON.stringify({ intent: r.intent })); return r }
let r = intent('पाटिल ने 50000 दिए', 'payment', (r) => r.amountPaise === 5000000 && r.customer.id === 'c1')
ok('payment match allocates to Patil invoices', r.match.allocations.length > 0 && r.match.customerId === 'c1')
intent('Patil ne pachas hazaar rupaye diye', 'payment', (r) => r.amountPaise === 5000000)
intent('Gujarat Snacks paid 2 lakh', 'payment', (r) => r.amountPaise === 20000000 && r.customer.id === 'c3')
intent('Patil paid', 'payment_missing', (r) => r.missing === 'amount')
intent('50000 aaye', 'payment_missing', (r) => r.missing === 'customer')
r = intent('आज किसको फ़ोन करूँ?', 'chase', (r) => r.top.length === 3)
intent('aaj kisko phone karun', 'chase')
intent('Who should I chase today?', 'chase')
intent('कुल कितना बाकी है?', 'owed', (r) => r.owedPaise > 0)
intent('kitna baaki hai', 'owed')
intent('How much is overdue?', 'overdue', (r) => r.overduePaise > 0)
r = intent('शिंदे का कितना बाकी है?', 'customer_owed', (r) => r.customer.id === 'c8' && r.owedPaise > 0)
intent('How much does Shinde owe?', 'customer_owed', (r) => r.customer.id === 'c8')
intent('नकदी कब कम पड़ेगी?', 'cash')
intent('When will cash run short?', 'cash')
intent('rescue plan dikhao', 'rescue')
intent('Patil ko reminder bhejo', 'reminder', (r) => r.customer.id === 'c1')
intent('blah blah', 'unknown')
intent('', 'empty')

// a spoken payment never changes the data by itself
ok('parsing does not change data', db.payments.length === makeSeedDb().payments.length)

console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
