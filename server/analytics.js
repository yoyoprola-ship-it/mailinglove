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

// Fire-and-forget: a failure here must never break a page load.
export async function recordVisit({ path = '/', ref = '', visitorId = '' } = {}) {
  const db = getDb()
  if (!db) return
  const day = dayKey()
  const dayRef = db.collection('analytics').doc(day)
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
        await dayRef.set({ uniques: FieldValue.increment(1) }, { merge: true })
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

  const today = days.find((d) => d.day === dayKey()) || { day: dayKey(), views: 0, uniques: 0 }
  // Count by calendar date, not by number of day-docs — days with no traffic
  // have no doc, so slice(-n) would reach further back than n days.
  const sum = (n) => {
    const cutoff = dayKey(new Date(Date.now() - (n - 1) * 86_400_000))
    return days.filter((d) => d.day >= cutoff).reduce((a, d) => a + d.views, 0)
  }

  let waitlistTotal = 0
  let waitlistRecent = []
  try {
    const countSnap = await db.collection('waitlist').count().get()
    waitlistTotal = countSnap.data().count
    const recentSnap = await db
      .collection('waitlist')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    waitlistRecent = recentSnap.docs.map((d) => {
      const v = d.data()
      return {
        email: v.email || '',
        category: v.category || null,
        createdAt: v.createdAt?.toMillis?.() || null,
      }
    })
  } catch (err) {
    console.warn('[analytics] waitlist read failed:', err?.message || err)
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
    waitlistTotal,
    waitlistRecent,
    usersTotal,
    usersRecent,
    ordersPending,
  }
}

function sanitizeKey(s) {
  return String(s).replace(/[.#$/[\]]/g, '_').slice(0, 200) || '_'
}
