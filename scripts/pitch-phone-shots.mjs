// Run: node scripts/pitch-phone-shots.mjs [outDir] — phone-size screenshots of the LIVE site for deck phone mock-ups.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'https://baaki-five.vercel.app'
const out = process.argv[2] || 'pitch-assets'
fs.mkdirSync(out, { recursive: true })
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: edge, headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
ctx.on('page', (p) => { if (/wa\.me/.test(p.url())) p.close().catch(() => {}) })
const page = await ctx.newPage()
const shot = (p, name) => p.screenshot({ path: path.join(out, name) })

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await shot(page, 'phone-1-home.png')

await page.goto(BASE + '/followups', { waitUntil: 'networkidle' })
await shot(page, 'phone-2-followups.png')

await page.goto(BASE + '/rescue', { waitUntil: 'networkidle' })
await shot(page, 'phone-3-rescue-top.png')
await page.evaluate(() => window.scrollTo(0, 560))
await page.waitForTimeout(250)
await shot(page, 'phone-4-rescue-offer.png')

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Speak' }).click()
await page.fill('#voice-q', 'पाटिल ने 50000 दिए')
await page.getByRole('button', { name: 'Go' }).click()
await page.waitForSelector('text=/Record ₹50,000/')
await shot(page, 'phone-5-voice-hindi.png')

// send an offer, then show what the customer sees (English) at the top of their page
await page.goto(BASE + '/rescue', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Send offer on WhatsApp' }).first().click()
await page.waitForSelector('text=/Offer sent/')
const db = await page.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))
const inv = db.invoices.find((i) => i.offer?.status === 'sent')
const cp = await ctx.newPage()
await cp.goto(`${BASE}/pay/${inv.token}`, { waitUntil: 'networkidle' })
await cp.getByRole('button', { name: 'English' }).click()
await cp.evaluate(() => window.scrollTo(0, 380))
await cp.waitForTimeout(250)
await shot(cp, 'phone-6-customer-offer.png')
await cp.evaluate(() => window.scrollTo(0, 0))
await shot(cp, 'phone-7-customer-invoice.png')

await page.goto(BASE + '/payments', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Use the sample statement' }).click()
await page.waitForTimeout(400)
await shot(page, 'phone-8-bank-matching.png')

await browser.close()
console.log(fs.readdirSync(out).filter((f) => f.startsWith('phone-')).join('\n'))
