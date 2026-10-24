// Run: node scripts/smoke.mjs — renders every route in English and Hindi and reports crashes.
import { createServer } from 'vite'

globalThis.window = { location: { origin: 'http://localhost:5173' }, scrollTo() {} }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { renderRoute, getIds } = await server.ssrLoadModule('/scripts/smoke-entry.jsx')
  const ids = getIds()
  const routes = [
    '/', '/followups', '/invoices', `/invoices/${ids.open}`, `/invoices/${ids.open}/print`, `/invoices/${ids.draft}`, '/new', `/new/${ids.draft}`,
    '/customers', '/payments', '/forecast', '/chase', '/rescue', '/inbox', '/documents', `/documents/evidence/${ids.open}`,
    `/letter/c5?inv=${ids.multi}`, '/letter/c5', '/settings', `/pay/${ids.token}`, '/pay/nope',
  ]
  let bad = 0
  for (const lang of ['en', 'hi']) {
    for (const r of routes) {
      try {
        const html = renderRoute(r, lang)
        if (r === '/pay/nope') { if (!/not valid|मान्य|सही नहीं/.test(html)) throw new Error('invalid-link page missing'); continue }
        if (html.length < 200) throw new Error('empty render')
        if (/\{[a-z]+\}/i.test(html.replace(/<[^>]+>/g, ' ')) && !r.startsWith('/new')) console.log('  unreplaced placeholder?', lang, r, html.match(/\{[a-z]+\}/i)[0])
        if (/>(nav|dash|inv|fu|pm|fc|doc|ev|letter|settings|pay|new|cust|err|chase|inbox|docs|flag|why|stage|status)\.[a-z_0-9]+</i.test(html)) console.log('  raw key shown?', lang, r, html.match(/>((nav|dash|inv|fu|pm|fc|doc|ev|letter|settings|pay|new|cust|err|chase|inbox|docs|flag|why|stage|status)\.[a-z_0-9]+)</i)[1])
      } catch (e) {
        bad++
        console.log('FAIL', lang, r, '\n  ', e.message.split('\n')[0])
      }
    }
  }
  console.log(bad ? `${bad} route(s) crashed` : `all ${routes.length * 2} renders OK`)
  process.exitCode = bad ? 1 : 0
} finally {
  await server.close()
}
