import { getStorage } from 'firebase-admin/storage'
import { getDb } from './firebaseAdmin.js'
import { catalog, getPostcard } from './catalog.js'

// Hi-res print files the admin uploads for catalog postcards. Stored in
// Cloud Storage under postcards-hires/<id>.<ext>; an override map in
// Firestore (config/overrides) points each postcardId at its stored file.
// Images are streamed through /api/postcard-image/:id so the bucket can
// stay private.

const BUCKET = process.env.STORAGE_BUCKET || 'mailinglove-eb540-hires'
const bucket = () => getStorage().bucket(BUCKET)

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

let cache = null
let cacheAt = 0

async function overrides() {
  if (cache && Date.now() - cacheAt < 20_000) return cache
  const db = getDb()
  let map = {}
  if (db) {
    try {
      const snap = await db.collection('config').doc('overrides').get()
      if (snap.exists) map = snap.data().map || {}
    } catch (err) {
      console.warn('[assets] overrides read failed:', err?.message || err)
    }
  }
  cache = map
  cacheAt = Date.now()
  return map
}

export async function hasHiRes(postcardId) {
  return Boolean((await overrides())[postcardId])
}

export async function uploadHiRes(postcardId, buffer, contentType) {
  if (!getPostcard(postcardId)) return { ok: false, error: 'Unknown postcard.' }
  const ext = EXT[contentType]
  if (!ext) return { ok: false, error: 'Use JPEG, PNG, WebP, or PDF.' }
  const path = `postcards-hires/${postcardId}.${ext}`
  await bucket().file(path).save(buffer, { contentType, resumable: false, metadata: { cacheControl: 'no-cache' } })

  const db = getDb()
  await db
    .collection('config')
    .doc('overrides')
    .set({ map: { [postcardId]: { path, contentType, updatedAt: Date.now() } } }, { merge: true })
  cache = null
  return { ok: true }
}

export async function removeHiRes(postcardId) {
  const map = await overrides()
  const entry = map[postcardId]
  if (!entry) return { ok: true }
  await bucket()
    .file(entry.path)
    .delete()
    .catch(() => {})
  const db = getDb()
  const { FieldValue } = await import('firebase-admin/firestore')
  await db
    .collection('config')
    .doc('overrides')
    .set({ map: { [postcardId]: FieldValue.delete() } }, { merge: true })
  cache = null
  return { ok: true }
}

// Stream the current best image for a postcard: the uploaded hi-res file if
// there is one, otherwise redirect to the static placeholder.
export async function streamImage(postcardId, res) {
  const card = getPostcard(postcardId)
  if (!card) return res.status(404).end()
  const entry = (await overrides())[postcardId]
  if (!entry) {
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.redirect(302, card.image)
  }
  try {
    const [buf] = await bucket().file(entry.path).download()
    res.setHeader('Content-Type', entry.contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.end(buf)
  } catch (err) {
    console.error('[assets] stream failed:', err?.message || err)
    res.redirect(302, card.image)
  }
}

// Catalog for the admin gallery: every postcard with its proxy image URL
// and whether a hi-res file is on file.
export async function adminCatalog() {
  const map = await overrides()
  return {
    types: catalog.types,
    postcards: catalog.postcards.map((p) => ({
      id: p.id,
      type: p.type,
      subcategory: p.subcategory || null,
      title: p.title,
      image: `/api/postcard-image/${p.id}`,
      hires: Boolean(map[p.id]),
    })),
  }
}
