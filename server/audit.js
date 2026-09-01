import { getDb } from './firebaseAdmin.js'

// Append-only change log. Every meaningful edit a customer makes to data
// that affects delivery — their profile/address and the recipient they set
// — is recorded here with a timestamp and the request IP, so a later
// "it was always right" claim can be checked against what was actually
// entered and when. Entries are never updated or deleted by the app.

const clip = (v) => (typeof v === 'string' ? v.slice(0, 300) : v)

export function clientIp(req) {
  const xff = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
  return (xff || req?.ip || req?.socket?.remoteAddress || '').replace(/^::ffff:/, '')
}

// Fire-and-forget: logging must never block or break the actual write.
export async function logChange({ email, kind, before, after, orderId, ip, userAgent } = {}) {
  const db = getDb()
  if (!db) return
  try {
    await db.collection('auditLog').add({
      at: Date.now(),
      email: String(email || '').toLowerCase(),
      kind, // 'consent.accept' | 'profile.update' | 'cart.recipient' | 'order.created' | 'order.paid' | 'order.status'
      before: before ?? null,
      after: after ?? null,
      orderId: orderId || null,
      ip: ip || null,
      userAgent: userAgent ? clip(userAgent) : null,
    })
  } catch (err) {
    console.warn('[audit] write failed:', err?.message || err)
  }
}

// Everything logged for one customer, newest first. Filtered by an
// equality on `email` (automatic single-field index) and sorted in memory
// so no composite index is needed.
export async function listAuditForEmail(email, limit = 500) {
  const db = getDb()
  if (!db || !email) return []
  const snap = await db
    .collection('auditLog')
    .where('email', '==', String(email).toLowerCase())
    .limit(Math.min(limit, 2000))
    .get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.at - a.at)
}

// Recent activity across all customers (admin overview).
export async function listRecentAudit(limit = 200) {
  const db = getDb()
  if (!db) return []
  const snap = await db
    .collection('auditLog')
    .orderBy('at', 'desc')
    .limit(Math.min(limit, 1000))
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
