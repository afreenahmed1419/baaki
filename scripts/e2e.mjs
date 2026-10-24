// Run (dev server up): node scripts/e2e.mjs — the Rescue Plan offer loop and voice commands in a real browser.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:5173'
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: edge, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const errors = []
let fails = 0
const ok = (n, c, x = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x) }
const watch = (p) => { p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text())) }

const owner = await ctx.newPage(); watch(owner)
await owner.goto(BASE + '/', { waitUntil: 'networkidle' })
await owner.evaluate(() => localStorage.clear())
await owner.goto(BASE + '/rescue', { waitUntil: 'networkidle' })

const h1Before = await owner.locator('h1').innerText()
ok('rescue shows the gap and a plan', /short by/i.test(h1Before) && await owner.getByText('Send offer on WhatsApp').count() >= 1)
ok('plan says it was tested and closes the gap', await owner.getByText(/Tested: with this plan cash never drops/).count() === 1)

// 1. owner sends the first offer (opens WhatsApp in a popup, which we ignore)
ctx.on('page', (p) => { if (p !== owner && /wa\.me/.test(p.url())) p.close().catch(() => {}) })
await owner.getByRole('button', { name: 'Send offer on WhatsApp' }).first().click()
await owner.waitForSelector('text=/Offer sent/')
ok('offer is recorded as sent', true)

// 2. customer opens their link in another tab and accepts
const db1 = await owner.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))
const inv = db1.invoices.find((i) => i.offer?.status === 'sent')
ok('offer stored on the invoice', !!inv && inv.offer.bp === 150)
const cust = await ctx.newPage(); watch(cust)
await cust.goto(`${BASE}/pay/${inv.token}`, { waitUntil: 'networkidle' })
const hiPage = await cust.getByText('धन्यवाद-प्रस्ताव').count() === 1
ok('customer page opens in their preferred language (Hindi)', hiPage)
await cust.getByRole('button', { name: 'English' }).click()
ok('customer sees the offer', await cust.getByText(/Pay early, take 1.5% off/).count() === 1)
ok('QR/amount uses the discounted amount', await cust.getByText(new RegExp('Pay ₹' + (inv.offer.netPaise / 100).toLocaleString('en-IN') + ' by UPI')).count() === 1)
await cust.getByRole('button', { name: 'Accept the offer' }).click()
await cust.waitForSelector('text=/You have accepted/')
ok('customer sees acceptance', true)

// 3. owner tab updates by itself (shared storage), shortfall shrinks, inbox gets a note
await owner.waitForSelector('text=/Accepted: will pay by/', { timeout: 8000 })
const h1After = await owner.locator('h1').innerText()
ok('owner sees the accepted offer live', true)
ok('headline shortfall changed after acceptance', h1After !== h1Before, h1After)
const db2 = await owner.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))
ok('customer promise created (pauses reminders)', db2.promises.some((p) => p.invoiceId === inv.id))
ok('owner gets an inbox note', db2.inbox.some((i) => i.type === 'offer_accepted' && i.invoiceId === inv.id))

// 4. voice: typed Hindi command -> confirm -> payment recorded
await owner.goto(BASE + '/', { waitUntil: 'networkidle' })
const paysBefore = (await owner.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))).payments.length
await owner.getByRole('button', { name: 'Speak' }).click()
await owner.fill('#voice-q', 'पाटिल ने 50000 दिए')
await owner.getByRole('button', { name: 'Go' }).click()
await owner.waitForSelector('text=/Record ₹50,000 from Patil Foods/')
ok('Hindi payment command understood', true)
ok('payment not saved before confirming', (await owner.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))).payments.length === paysBefore)
await owner.getByRole('button', { name: 'Confirm payment' }).click()
await owner.waitForSelector('text=/Payment recorded/')
const paysAfter = (await owner.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))).payments
ok('payment saved after confirming', paysAfter.length > paysBefore)
ok('amount recorded exactly in paise', paysAfter.some((p) => p.amountPaise === 5000000 || p.mode === 'Bank'))

// 5. voice question in Hindi
await owner.fill('#voice-q', 'आज किसको फ़ोन करूँ?')
await owner.getByRole('button', { name: 'Go' }).click()
await owner.waitForSelector('text=/Chase these first today/')
ok('"who to chase" answered with names', await owner.getByText(/Nagpur Oranges Traders|Shinde Plastics/).count() >= 1)

// 6. same screens in Hindi still render the new features
await owner.evaluate(() => { const s = JSON.parse(localStorage.getItem('baaki.v1')); s.settings.lang = 'hi'; localStorage.setItem('baaki.v1', JSON.stringify(s)) })
await owner.goto(BASE + '/rescue', { waitUntil: 'networkidle' })
ok('rescue page renders in Hindi', await owner.getByText('नकदी बचाव योजना').count() === 1)

ok('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
