// Serverless function: reads a photo/PDF of an invoice with Claude and returns structured fields.
// The API key stays here on the server (env var ANTHROPIC_API_KEY). Nothing is stored: the file
// only lives in memory for the length of the request.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'
const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

const PROMPT = `You are reading an Indian business invoice (a photo or PDF). Extract the fields below and answer with ONE JSON object and nothing else.

{
  "invoiceNumber": string|null,
  "invoiceDate": "YYYY-MM-DD"|null,
  "dueDate": "YYYY-MM-DD"|null,
  "customerName": string|null,
  "customerGstin": string|null,
  "customerAddress": string|null,
  "items": [{"description": string, "hsn": string|null, "qty": number|null, "unit": string|null, "rate": number|null, "discountPct": number|null, "gstRate": number|null}],
  "printed": {"taxableValue": number|null, "cgst": number|null, "sgst": number|null, "igst": number|null, "total": number|null},
  "uncertain": [string]
}

Rules:
- All money in rupees as plain numbers (no symbols, no commas). rate is the price per unit before tax.
- gstRate is the percent for that line (for example 5 or 18). If the invoice shows only CGST+SGST, add them (9+9 = 18).
- Use null when a value is not visible. NEVER guess or invent a value.
- In "uncertain" list every field you could not read clearly or had to infer, using names like "customerGstin", "invoiceDate", "items[0].hsn", "items[2].rate", "printed.total".
- Copy GSTIN exactly as printed, in capitals.`

function extractJson(text) {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a < 0 || b < a) throw new Error('No JSON in model reply')
  return JSON.parse(text.slice(a, b + 1))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'not_configured' })

  const { mediaType, data } = req.body || {}
  if (!ALLOWED.includes(mediaType)) return res.status(400).json({ error: 'unsupported_type' })
  if (typeof data !== 'string' || !data) return res.status(400).json({ error: 'no_data' })
  if (Math.floor((data.length * 3) / 4) > MAX_BYTES) return res.status(413).json({ error: 'too_large' })

  const block = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data } }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }] }),
    })
    if (!r.ok) return res.status(502).json({ error: 'ai_failed', status: r.status })
    const out = await r.json()
    const text = (out.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
    return res.status(200).json(extractJson(text))
  } catch {
    return res.status(502).json({ error: 'unreadable' })
  }
}
