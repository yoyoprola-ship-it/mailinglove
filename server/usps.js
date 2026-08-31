// USPS Service Standards API — how many business days First-Class Mail
// (letters + postcards) takes between two ZIPs. OAuth2 client-credentials.
// Register at https://developers.usps.com for USPS_CLIENT_ID / _SECRET.

const BASE = 'https://apis.usps.com'
const ID = process.env.USPS_CLIENT_ID || ''
const SECRET = process.env.USPS_CLIENT_SECRET || ''

export const uspsConfigured = () => Boolean(ID && SECRET)

let token = null
let tokenExp = 0

async function accessToken() {
  if (token && Date.now() < tokenExp) return token
  const res = await fetch(`${BASE}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ID,
      client_secret: SECRET,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`USPS auth failed: ${data.error_description || res.status}`)
  token = data.access_token
  tokenExp = Date.now() + (data.expires_in - 120) * 1000
  return token
}

const cache = new Map() // `${o}-${d}` -> { days, at }
const TTL = 6 * 60 * 60 * 1000

const zip5 = (z) => String(z || '').replace(/\D/g, '').slice(0, 5)

// Returns { days } for First-Class Mail, or null if it can't be determined.
export async function firstClassDays(originZip, destZip) {
  const o = zip5(originZip)
  const d = zip5(destZip)
  if (o.length !== 5 || d.length !== 5) return null
  if (o === d) return { days: 1 }

  const key = `${o}-${d}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return { days: hit.days }

  const t = await accessToken()
  const url = `${BASE}/service-standards/v3/estimates?originZIPCode=${o}&destinationZIPCode=${d}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`USPS estimates ${res.status}: ${JSON.stringify(data).slice(0, 200)}`)

  const days = pickFirstClassDays(data)
  if (days == null) return null
  cache.set(key, { days, at: Date.now() })
  return { days }
}

// The v3 payload has varied slightly across revisions; scan defensively for
// a First-Class entry and its day count.
function pickFirstClassDays(data) {
  const buckets = data?.mailClasses || data?.serviceStandards || data?.estimates || []
  const list = Array.isArray(buckets) ? buckets : []
  const fc = list.find((m) => /first[- ]?class/i.test(m.mailClass || m.name || m.class || ''))
  const raw = fc && (fc.serviceStandard ?? fc.days ?? fc.numberOfDays ?? fc.standard)
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0 && n < 15) return Math.round(n)

  // fall back to any numeric day value in the response
  const any = list
    .map((m) => Number(m.serviceStandard ?? m.days ?? m.numberOfDays))
    .filter((x) => Number.isFinite(x) && x > 0)
  return any.length ? Math.round(Math.max(...any)) : null
}
