// Run: node scripts/shots.mjs [outDir] — opens the running dev server in Edge, screenshots key screens
// on phone and laptop sizes, and reports console errors / failed requests / horizontal overflow.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const out = process.argv[2] || 'shots'
fs.mkdirSync(out, { recursive: true })
const BASE = process.env.BASE || 'http://localhost:5173'
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: edge, headless: true })

const routes = [
  ['home', '/'], ['rescue', '/rescue'], ['followups', '/followups'], ['invoices', '/invoices'], ['forecast', '/forecast'],
  ['payments', '/payments'], ['inbox', '/inbox'], ['chase', '/chase'], ['new', '/new'], ['customers', '/customers'], ['settings', '/settings'],
]
const problems = []
for (const [label, w, h] of [['phone', 390, 844], ['desk', 1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`[${label}] console ${m.type()}: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message.slice(0, 200)}`))
  page.on('requestfailed', (r) => problems.push(`[${label}] request failed: ${r.url().slice(0, 120)}`))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  for (const lang of ['en', 'hi']) {
    for (const [name, url] of routes) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' })
      if (lang === 'hi') { await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('baaki.v1') || '{}'); if (s.settings) { s.settings.lang = 'hi'; localStorage.setItem('baaki.v1', JSON.stringify(s)) } }); await page.reload({ waitUntil: 'networkidle' }) }
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 1) problems.push(`[${label}/${lang}] horizontal overflow ${over}px on ${url}`)
      if (lang === 'en' || name === 'home' || name === 'rescue') await page.screenshot({ path: path.join(out, `${label}-${lang}-${name}.png`), fullPage: true })
    }
    if (lang === 'en') { await page.goto(BASE + '/settings', { waitUntil: 'networkidle' }); await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('baaki.v1') || 'null'); if (s) { s.settings.lang = 'en'; localStorage.setItem('baaki.v1', JSON.stringify(s)) } }) }
  }
  await ctx.close()
}
await browser.close()
console.log(problems.length ? problems.join('\n') : 'no console errors, no failed requests, no horizontal overflow')
