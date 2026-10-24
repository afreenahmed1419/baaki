import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import App from '../src/App.jsx'
import { AppProvider } from '../src/store.jsx'
import { makeSeedDb } from '../src/data/index.js'

export function getIds() {
  const db = makeSeedDb()
  return {
    open: db.invoices.find((i) => i.key === 'exact').id,
    draft: db.invoices.find((i) => i.draft).id,
    multi: db.invoices.find((i) => i.key === 'multi2').id,
    token: db.invoices.find((i) => i.key === 'dispute').token,
  }
}

export function renderRoute(url, lang) {
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ ...makeSeedDb(), settings: { ...makeSeedDb().settings, lang } }),
    setItem() {},
  }
  return renderToString(
    <StaticRouter location={url}>
      <AppProvider><App /></AppProvider>
    </StaticRouter>,
  )
}
