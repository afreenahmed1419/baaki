import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development, serve /api/* from the same files Vercel runs in production.
function devApi(env) {
  return {
    name: 'baaki-dev-api',
    configureServer(server) {
      Object.assign(process.env, env)
      server.middlewares.use('/api/read-invoice', async (req, res) => {
        const chunks = []
        for await (const c of req) chunks.push(c)
        let body = {}
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { /* leave empty */ }
        const send = (status) => ({ json: (obj) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)) } })
        const shim = { status: send, json: (o) => send(200).json(o) }
        const mod = await server.ssrLoadModule('/api/read-invoice.js')
        await mod.default({ method: req.method, body }, shim)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devApi(loadEnv(mode, process.cwd(), ''))],
}))
