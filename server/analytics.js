import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import { getDb } from './firebaseAdmin.js'

// Analytics "day" is anchored to US Eastern, not UTC — otherwise the daily
// counters roll over mid-evening for a US audience and a night's traffic gets
// split across two buckets. en-CA formats as YYYY-MM-DD.
const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dayKey = (d = new Date()) => DAY_FMT.format(d)

// --- visitor country -------------------------------------------------

const geoCache = new Map() // ip -> 2-letter code ('' = unknown), bounded
const isPrivateIp = (ip) =>
  !ip ||
  ip === '127.0.0.1' ||
  ip === '::1' ||
  ip.startsWith('10.') ||
  ip.startsWith('192.168.') ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
  ip.startsWith('fc') ||
  ip.startsWith('fd')

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ip = xff || req.ip || req.socket?.remoteAddress || ''
  return ip.replace(/^::ffff:/, '')
}

// Best-effort 2-letter country for a request: a proxy/CDN header if present,
// otherwise a keyless IP lookup (cached per IP for the process lifetime).
export async function geoCountry(req) {
  const hdr = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-appengine-country'] ||
    req.headers['x-country-code'] ||
    ''
  )
    .toString()
    .toUpperCase()
  if (/^[A-Z]{2}$/.test(hdr) && hdr !== 'XX') return hdr

  const ip = clientIp(req)
  if (isPrivateIp(ip)) return ''
  if (geoCache.has(ip)) return geoCache.get(ip)

  const timeout = () => (AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined)
  const ok = (c) => (/^[A-Z]{2}$/.test(c || '') && c !== 'XX' ? c : '')
  let code = ''

  // Two keyless HTTPS providers; first hit wins.
  try {
    const r = await fetch(
      `https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`,
      { signal: timeout() }
    )
    if (r.ok) code = ok((await r.json())?.country?.toUpperCase())
  } catch (err) {
    console.warn('[geo] geojs failed:', err?.message || err)
  }
  if (!code) {
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code`, {
        signal: timeout(),
      })
      if (r.ok) code = ok((await r.json())?.country_code?.toUpperCase())
    } catch (err) {
      console.warn('[geo] ipwho failed:', err?.message || err)
    }
  }

  console.log(`[geo] ip=${ip} -> ${code || 'unknown'}`)
  if (geoCache.size > 5000) geoCache.clear()
  geoCache.set(ip, code)
  return code
}

// Fire-and-forget: a failure here must never break a page load.
export async function recordVisit({ path = '/', ref = '', visitorId = '', country = '' } = {}) {
  const db = getDb()
  if (!db) return
  const day = dayKey()
  const dayRef = db.collection('analytics').doc(day)
  const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : ''
  try {
    await dayRef.set(
      {
        views: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        [`paths.${sanitizeKey(path)}`]: FieldValue.increment(1),
      },
      { merge: true }
    )
    if (visitorId) {
      try {
        await dayRef.collection('visitors').doc(sanitizeKey(visitorId)).create({ ref, at: Date.now() })
        const patch = { uniques: FieldValue.increment(1) }
        if (cc) patch[`geo.${cc}`] = FieldValue.increment(1)
        await dayRef.set(patch, { merge: true })
      } catch {
        // visitor already counted today
      }
    }
  } catch (err) {
    console.warn('[analytics] recordVisit failed:', err?.message || err)
  }
}

export async function getStats() {
  const db = getDb()
  if (!db) return { available: false }

  // Day docs are keyed YYYY-MM-DD, so a >= filter on the document id gives
  // the last ~30 days using the automatic ascending __name__ index — no
  // composite index to create.
  const since = dayKey(new Date(Date.now() - 30 * 86_400_000))
  const daysSnap = await db
    .collection('analytics')
    .where(FieldPath.documentId(), '>=', since)
    .get()

  const days = daysSnap.docs
    .map((d) => ({ day: d.id, views: d.data().views || 0, uniques: d.data().uniques || 0 }))
    .sort((a, b) => a.day.localeCompare(b.day))

  // Countries of unique visitors over the window.
  const geoTotals = {}
  for (const d of daysSnap.docs) {
    const g = d.data().geo || {}
    for (const [code, n] of Object.entries(g)) geoTotals[code] = (geoTotals[code] || 0) + (n || 0)
  }
  const regionName =
    typeof Intl !== 'undefined' && Intl.DisplayNames
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null
  const countries = Object.entries(geoTotals)
    .map(([code, count]) => ({
      code,
      count,
      name: (() => {
        try {
          return regionName?.of(code) || code
        } catch {
          return code
        }
      })(),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const today = days.find((d) => d.day === dayKey()) || { day: dayKey(), views: 0, uniques: 0 }
  // Count by calendar date, not by number of day-docs — days with no traffic
  // have no doc, so slice(-n) would reach further back than n days.
  const sum = (n) => {
    const cutoff = dayKey(new Date(Date.now() - (n - 1) * 86_400_000))
    return days.filter((d) => d.day >= cutoff).reduce((a, d) => a + d.views, 0)
  }

  let ordersPending = 0
  try {
    const snap = await db.collection('orders').where('status', '==', 'paid').count().get()
    ordersPending = snap.data().count
  } catch (err) {
    console.warn('[analytics] orders count failed:', err?.message || err)
  }

  let usersTotal = 0
  let usersRecent = []
  try {
    const countSnap = await db.collection('users').count().get()
    usersTotal = countSnap.data().count
    const recentSnap = await db.collection('users').orderBy('createdAt', 'desc').limit(20).get()
    usersRecent = recentSnap.docs.map((d) => {
      const v = d.data()
      return {
        email: v.email || '',
        name: v.name || '',
        city: v.address?.city || '',
        state: v.address?.state || '',
        hasAddress: Boolean(v.address?.line1),
        createdAt: v.createdAt || null,
      }
    })
  } catch (err) {
    console.warn('[analytics] users read failed:', err?.message || err)
  }

  return {
    available: true,
    today,
    last7: sum(7),
    last30: sum(30),
    days,
    countries,
    usersTotal,
    usersRecent,
    ordersPending,
  }
}

function sanitizeKey(s) {
  return String(s).replace(/[.#$/[\]]/g, '_').slice(0, 200) || '_'
}
