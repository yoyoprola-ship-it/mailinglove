import { getDb } from './firebaseAdmin.js'
import { saveFile, downloadFile, deleteFile, EXT } from './bucket.js'
import { getPostcard, adminList, catalog } from './catalog.js'

// Hi-res print files the admin uploads to replace a catalog card's image.
// Stored in Cloud Storage under postcards-hires/<id>.<ext>; an override map
// in Firestore (config/overrides) points each postcardId at its stored file.
// Images are streamed through /api/postcard-image/:id so the bucket can stay
// private. Admin-created ("custom") cards keep their own image in the bucket
// too — that path lives on the card itself (see catalog.js).

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
  if (!(await getPostcard(postcardId))) return { ok: false, error: 'Unknown postcard.' }
  const ext = EXT[contentType]
  if (!ext) return { ok: false, error: 'Use JPEG, PNG, WebP, or PDF.' }
  const path = `postcards-hires/${postcardId}.${ext}`
  await saveFile(path, buffer, contentType)

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
  await deleteFile(entry.path)
  const db = getDb()
  const { FieldValue } = await import('firebase-admin/firestore')
  await db
    .collection('config')
    .doc('overrides')
    .set({ map: { [postcardId]: FieldValue.delete() } }, { merge: true })
  cache = null
  return { ok: true }
}

// Stream the current best image for a postcard: an uploaded hi-res file if
// there is one, then the card's own stored file (admin-created cards),
// otherwise redirect to the static placeholder.
export async function streamImage(postcardId, res) {
  const card = await getPostcard(postcardId)
  if (!card) return res.status(404).end()

  const entry = (await overrides())[postcardId]
  const src =
    entry ||
    (card.storagePath ? { path: card.storagePath, contentType: card.contentType } : null)

  if (!src) {
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.redirect(302, card.image)
  }
  try {
    const buf = await downloadFile(src.path)
    res.setHeader('Content-Type', src.contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.end(buf)
  } catch (err) {
    console.error('[assets] stream failed:', err?.message || err)
    if (card.storagePath && !entry) return res.status(404).end()
    res.redirect(302, card.image)
  }
}

// Catalog for the admin gallery: every card with its proxy image URL, whether
// a hi-res file is on file, and whether it is a custom / hidden card.
export async function adminCatalog() {
  const map = await overrides()
  const list = await adminList()
  return {
    types: catalog.types,
    postcards: list.map((p) => ({
      id: p.id,
      type: p.type,
      subcategory: p.subcategory || null,
      title: p.title,
      image: `/api/postcard-image/${p.id}`,
      hires: Boolean(map[p.id]),
      custom: p.custom,
      hidden: p.hidden,
    })),
  }
}
