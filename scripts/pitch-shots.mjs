// Run: node scripts/pitch-shots.mjs [outDir] — slide-ready screenshots of the LIVE site (16:9 laptop + phone).
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'https://baaki-five.vercel.app'
const out = process.argv[2] || 'pitch-assets'
fs.mkdirSync(out, { recursive: true })
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: edge, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
ctx.on('page', (p) => { if (/wa\.me/.test(p.url())) p.close().catch(() => {}) })
const page = await ctx.newPage()
const shot = (p, name) => p.screenshot({ path: path.join(out, name) })

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await shot(page, '01-home-warning.png')

await page.goto(BASE + '/rescue', { waitUntil: 'networkidle' })
await shot(page, '02-rescue-plan.png')
await page.evaluate(() => window.scrollTo(0, 650))
await page.waitForTimeout(300)
await shot(page, '03-rescue-offers-and-cost.png')

await page.goto(BASE + '/forecast', { waitUntil: 'networkidle' })
await shot(page, '04-forecast.png')

await page.goto(BASE + '/payments', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Use the sample statement' }).click()
await page.waitForTimeout(500)
await shot(page, '05-bank-matching.png')

// voice panel with a Hindi command
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Speak' }).click()
await page.fill('#voice-q', 'पाटिल ने 50000 दिए')
await page.getByRole('button', { name: 'Go' }).click()
await page.waitForSelector('text=/Record ₹50,000/')
await shot(page, '06-voice-hindi.png')

// offer sent -> customer page on a phone (Hindi, then English)
await page.goto(BASE + '/rescue', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Send offer on WhatsApp' }).first().click()
await page.waitForSelector('text=/Offer sent/')
const db = await page.evaluate(() => JSON.parse(localStorage.getItem('baaki.v1')))
const inv = db.invoices.find((i) => i.offer?.status === 'sent')
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const cp = await phone.newPage()
await cp.addInitScript((s) => localStorage.setItem('baaki.v1', s), JSON.stringify(db))
await cp.goto(`${BASE}/pay/${inv.token}`, { waitUntil: 'networkidle' })
await cp.screenshot({ path: path.join(out, '07-customer-offer-hindi-phone.png'), fullPage: true })
await cp.getByRole('button', { name: 'English' }).click()
await cp.screenshot({ path: path.join(out, '08-customer-offer-english-phone.png'), fullPage: true })

// invoice document
await page.goto(BASE + '/invoices', { waitUntil: 'networkidle' })
await page.goto(`${BASE}/invoices/${inv.id}/print`, { waitUntil: 'networkidle' })
await shot(page, '09-gst-invoice.png')

await browser.close()
console.log(fs.readdirSync(out).join('\n'))
