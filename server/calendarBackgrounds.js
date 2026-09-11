import crypto from 'node:crypto'
import sharp from 'sharp'
import { getDb } from './firebaseAdmin.js'
import { saveFile, downloadFile, deleteFile, EXT } from './bucket.js'

// Admin-managed, ready-made calendar backgrounds. Same shape as the
// postcard catalog (server/catalog.js), just without categories: one
// Firestore doc + two Cloud Storage objects per background (the full
// 8x10 image used for the actual render, and a small thumbnail so the
// picker grid doesn't make every visitor download the full-size art).
//
// calendarBackgrounds/<id> = {
//   id, storagePath, thumbPath, contentType, hidden, order,
//   createdAt, updatedAt
// }

const COLL = 'calendarBackgrounds'
const THUMB_W = 320
const THUMB_H = 400

let cache = null
let cacheAt = 0

export function invalidateCalendarBackgrounds() {
  cache = null
}

async function listAll() {
  if (cache && Date.now() - cacheAt < 30_000) return cache
  const db = getDb()
  let rows = []
  if (db) {
    try {
      const snap = await db.collection(COLL).get()
      rows = snap.docs.map((d) => d.data()).sort((a, b) => (a.order || 0) - (b.order || 0))
    } catch (err) {
      console.warn('[calendarBg] list failed:', err?.message || err)
    }
  }
  cache = rows
  cacheAt = Date.now()
  return rows
}

const imageUrl = (b, thumb) =>
  `/api/calendar-bg-image/${b.id}?v=${b.updatedAt || 0}${thumb ? '&thumb=1' : ''}`

const publicBg = (b) => ({
  id: b.id,
  image: imageUrl(b),
  thumb: b.thumbPath ? imageUrl(b, true) : imageUrl(b),
})

// Storefront list: visible ones only, in order.
export async function getPublicBackgrounds() {
  const rows = await listAll()
  return rows.filter((b) => !b.hidden).map(publicBg)
}

// Single background — read straight from Firestore for streaming.
export async function getBackground(id) {
  const db = getDb()
  if (!db || !id) return null
  try {
    const snap = await db.collection(COLL).doc(String(id)).get()
    return snap.exists ? snap.data() : null
  } catch (err) {
    console.warn('[calendarBg] getBackground failed:', err?.message || err)
    return null
  }
}

// Admin gallery: every background, hidden included.
export async function adminListBackgrounds() {
  const rows = await listAll()
  return rows.map((b) => ({
    id: b.id,
    image: imageUrl(b),
    thumb: b.thumbPath ? imageUrl(b, true) : imageUrl(b),
    hidden: Boolean(b.hidden),
    updatedAt: b.updatedAt || 0,
  }))
}

function checkImage(contentType) {
  const ext = EXT[contentType]
  return ext && ext !== 'pdf' ? ext : null
}

export async function addBackground({ buffer, contentType }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ext = checkImage(contentType)
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const id = crypto.randomBytes(6).toString('hex')
  const storagePath = `${COLL}/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)

  // Best-effort thumbnail — if it fails for any reason, the picker just
  // falls back to the full image for this one instead of breaking the add.
  let thumbPath = null
  try {
    const thumbBuf = await sharp(buffer)
      .resize({ width: THUMB_W, height: THUMB_H, fit: 'cover', position: 'centre' })
      .jpeg({ quality: 72 })
      .toBuffer()
    thumbPath = `${COLL}/${id}-thumb.jpg`
    await saveFile(thumbPath, thumbBuf, 'image/jpeg')
  } catch (err) {
    console.warn('[calendarBg] thumbnail failed:', err?.message || err)
  }

  const rows = await listAll()
  const now = Date.now()
  const doc = {
    id,
    storagePath,
    thumbPath,
    contentType,
    hidden: false,
    order: (rows.reduce((m, b) => Math.max(m, b.order || 0), 0) || 0) + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection(COLL).doc(id).set(doc)
  invalidateCalendarBackgrounds()
  return { ok: true, background: publicBg(doc) }
}

export async function setBackgroundHidden(id, hidden) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown background.' }
  await ref.set({ hidden: Boolean(hidden), updatedAt: Date.now() }, { merge: true })
  invalidateCalendarBackgrounds()
  return { ok: true }
}

// Permanent: the document and both its image objects are gone for good.
export async function deleteBackground(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown background.' }
  const { storagePath, thumbPath } = snap.data()
  if (storagePath) await deleteFile(storagePath)
  if (thumbPath) await deleteFile(thumbPath)
  await ref.delete()
  invalidateCalendarBackgrounds()
  return { ok: true }
}

// Stream a background's image straight from Cloud Storage. `thumb` serves
// the small picker-grid version when one exists.
export async function streamBackground(
  id,
  res,
  { download = false, versioned = false, thumb = false } = {}
) {
  const bg = await getBackground(id)
  if (!bg) return res.status(404).end()
  const useThumb = thumb && bg.thumbPath
  const path = useThumb ? bg.thumbPath : bg.storagePath
  if (!path) return res.status(404).end()
  try {
    const buf = await downloadFile(path)
    res.setHeader('Content-Type', useThumb ? 'image/jpeg' : bg.contentType || 'application/octet-stream')
    if (download) {
      const ext = (path.split('.').pop() || 'jpg').toLowerCase()
      res.setHeader('Content-Disposition', `attachment; filename="calendar-bg-${id}.${ext}"`)
      res.setHeader('Cache-Control', 'no-store')
    } else if (versioned) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60')
    }
    res.end(buf)
  } catch (err) {
    console.error('[calendarBg] stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}
