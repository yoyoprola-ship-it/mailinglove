import crypto from 'node:crypto'
import sharp from 'sharp'
import { getDb } from './firebaseAdmin.js'
import { saveFile, downloadFile, deleteFile } from './bucket.js'

// A "frame" is a physical picture frame the shop sells: price includes the
// frame, a print of a photo the customer picks, and shipping. One Firestore
// doc per product (frameProducts/<id>); its listing photos (what the
// customer sees on the card, and in the "see more" gallery) are separate
// Storage objects, each with its own small thumbnail — same split as
// calendarBackgrounds, so the shop grid never has to pull full-size images.
//
// frameProducts/<id> = {
//   id, name, priceCents, mounts: ['wall' | 'stand', ...],
//   ratioId, ratioW, ratioH,               // the frame's photo opening
//   images: [{ id, path, thumbPath, contentType }],
//   hidden, order, createdAt, updatedAt,
// }

const COLL = 'frameProducts'
const MAX_IMAGES = 8
const IMG_MAX = 1400 // long edge of a stored gallery photo — these are marketing shots, not the print file
const THUMB_W = 480
const THUMB_H = 480

export const MOUNT_OPTIONS = ['wall', 'stand']
export const MOUNT_LABELS = { wall: 'Wall hanging', stand: 'Tabletop stand' }

// Common frame opening sizes. `w`/`h` are inches — they set both the crop
// aspect ratio and the 300 DPI print target for the customer's photo.
export const FRAME_RATIOS = [
  { id: '4x4', label: '4×4 in — square', w: 4, h: 4 },
  { id: '4x6', label: '4×6 in', w: 4, h: 6 },
  { id: '5x7', label: '5×7 in', w: 5, h: 7 },
  { id: '8x8', label: '8×8 in — square', w: 8, h: 8 },
  { id: '8x10', label: '8×10 in', w: 8, h: 10 },
  { id: '11x14', label: '11×14 in', w: 11, h: 14 },
]

let cache = null
let cacheAt = 0

export function invalidateFrameProducts() {
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
      console.warn('[frames] list failed:', err?.message || err)
    }
  }
  cache = rows
  cacheAt = Date.now()
  return rows
}

const imgUrl = (frameId, img, thumb) =>
  `/api/frame-image/${frameId}/${img.id}${thumb ? '?thumb=1' : ''}`

const publicFrame = (f) => {
  const images = (f.images || []).map((img) => ({
    id: img.id,
    image: imgUrl(f.id, img, false),
    thumb: img.thumbPath ? imgUrl(f.id, img, true) : imgUrl(f.id, img, false),
  }))
  return {
    id: f.id,
    name: f.name,
    priceCents: f.priceCents || 0,
    mounts: f.mounts || [],
    ratioId: f.ratioId,
    ratioW: f.ratioW,
    ratioH: f.ratioH,
    images,
    thumb: images[0]?.thumb || null,
  }
}

// Storefront: visible products only.
export async function getPublicFrames() {
  const rows = await listAll()
  return rows.filter((f) => !f.hidden).map(publicFrame)
}

// Internal doc — used to validate a cart add (price, mounts, ratio).
export async function getFrame(id) {
  const db = getDb()
  if (!db || !id) return null
  try {
    const snap = await db.collection(COLL).doc(String(id)).get()
    return snap.exists ? snap.data() : null
  } catch (err) {
    console.warn('[frames] getFrame failed:', err?.message || err)
    return null
  }
}

// Admin: every product, hidden included.
export async function adminListFrames() {
  const rows = await listAll()
  return rows.map((f) => ({
    ...publicFrame(f),
    hidden: Boolean(f.hidden),
    updatedAt: f.updatedAt || 0,
  }))
}

// --- writes ------------------------------------------------------

function validMounts(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',')
  const out = arr.map((m) => String(m).trim()).filter((m) => MOUNT_OPTIONS.includes(m))
  return [...new Set(out)]
}

function ratioFor(id) {
  return FRAME_RATIOS.find((r) => r.id === id) || null
}

async function buildImageEntry(id, buffer) {
  const full = await sharp(buffer)
    .rotate()
    .resize({ width: IMG_MAX, height: IMG_MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer()
  const thumb = await sharp(buffer)
    .rotate()
    .resize({ width: THUMB_W, height: THUMB_H, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 72 })
    .toBuffer()
  const imgId = crypto.randomBytes(5).toString('hex')
  const path = `${COLL}/${id}/${imgId}.jpg`
  const thumbPath = `${COLL}/${id}/${imgId}-thumb.jpg`
  await saveFile(path, full, 'image/jpeg')
  await saveFile(thumbPath, thumb, 'image/jpeg')
  return { id: imgId, path, thumbPath, contentType: 'image/jpeg' }
}

export async function addFrame({ name, priceCents, mounts, ratioId, buffers = [] }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const nm = String(name || '').trim().slice(0, 80)
  if (!nm) return { ok: false, error: 'Name is required.' }
  const price = Math.trunc(Number(priceCents))
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Set a price greater than $0.' }
  const mts = validMounts(mounts)
  if (!mts.length) return { ok: false, error: 'Pick at least one mount option.' }
  const ratio = ratioFor(ratioId)
  if (!ratio) return { ok: false, error: 'Pick a valid photo size.' }
  const files = (buffers || []).filter(Boolean).slice(0, MAX_IMAGES)
  if (!files.length) return { ok: false, error: 'Add at least one photo of this frame.' }

  const id = crypto.randomBytes(6).toString('hex')
  const images = []
  for (const buf of files) {
    images.push(await buildImageEntry(id, buf))
  }

  const rows = await listAll()
  const now = Date.now()
  const doc = {
    id,
    name: nm,
    priceCents: price,
    mounts: mts,
    ratioId: ratio.id,
    ratioW: ratio.w,
    ratioH: ratio.h,
    images,
    hidden: false,
    order: (rows.reduce((m, f) => Math.max(m, f.order || 0), 0) || 0) + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection(COLL).doc(id).set(doc)
  invalidateFrameProducts()
  return { ok: true, frame: publicFrame(doc) }
}

export async function updateFrame(id, patch = {}) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown frame.' }
  const upd = { updatedAt: Date.now() }
  if (patch.name !== undefined) {
    const nm = String(patch.name || '').trim().slice(0, 80)
    if (!nm) return { ok: false, error: 'Name is required.' }
    upd.name = nm
  }
  if (patch.priceCents !== undefined) {
    const price = Math.trunc(Number(patch.priceCents))
    if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Set a price greater than $0.' }
    upd.priceCents = price
  }
  if (patch.mounts !== undefined) {
    const mts = validMounts(patch.mounts)
    if (!mts.length) return { ok: false, error: 'Pick at least one mount option.' }
    upd.mounts = mts
  }
  if (patch.ratioId !== undefined) {
    const ratio = ratioFor(patch.ratioId)
    if (!ratio) return { ok: false, error: 'Pick a valid photo size.' }
    upd.ratioId = ratio.id
    upd.ratioW = ratio.w
    upd.ratioH = ratio.h
  }
  await ref.set(upd, { merge: true })
  invalidateFrameProducts()
  const fresh = (await ref.get()).data()
  return { ok: true, frame: publicFrame(fresh) }
}

export async function addFrameImages(id, buffers = []) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown frame.' }
  const frame = snap.data()
  const files = (buffers || []).filter(Boolean)
  if (!files.length) return { ok: false, error: 'Attach at least one photo.' }
  const existing = frame.images || []
  if (existing.length >= MAX_IMAGES) return { ok: false, error: `Up to ${MAX_IMAGES} photos per frame.` }
  const room = MAX_IMAGES - existing.length
  const added = []
  for (const buf of files.slice(0, room)) {
    added.push(await buildImageEntry(id, buf))
  }
  const images = [...existing, ...added]
  await ref.set({ images, updatedAt: Date.now() }, { merge: true })
  invalidateFrameProducts()
  return { ok: true, frame: publicFrame({ ...frame, images }) }
}

export async function deleteFrameImage(id, imageId) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown frame.' }
  const frame = snap.data()
  const images = frame.images || []
  const img = images.find((x) => x.id === imageId)
  if (!img) return { ok: false, error: 'Unknown photo.' }
  if (images.length <= 1) return { ok: false, error: 'A frame needs at least one photo.' }
  const next = images.filter((x) => x.id !== imageId)
  await deleteFile(img.path)
  if (img.thumbPath) await deleteFile(img.thumbPath)
  await ref.set({ images: next, updatedAt: Date.now() }, { merge: true })
  invalidateFrameProducts()
  return { ok: true, frame: publicFrame({ ...frame, images: next }) }
}

export async function setFrameHidden(id, hidden) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown frame.' }
  await ref.set({ hidden: Boolean(hidden), updatedAt: Date.now() }, { merge: true })
  invalidateFrameProducts()
  return { ok: true }
}

// Permanent: the document and every image object are gone for good.
export async function deleteFrame(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown frame.' }
  const { images = [] } = snap.data()
  for (const img of images) {
    await deleteFile(img.path)
    if (img.thumbPath) await deleteFile(img.thumbPath)
  }
  await ref.delete()
  invalidateFrameProducts()
  return { ok: true }
}

export async function streamFrameImage(frameId, imageId, res, { download = false, thumb = false } = {}) {
  const frame = await getFrame(frameId)
  const img = frame?.images?.find((x) => x.id === imageId)
  if (!img) return res.status(404).end()
  const useThumb = thumb && img.thumbPath
  const filePath = useThumb ? img.thumbPath : img.path
  try {
    const buf = await downloadFile(filePath)
    res.setHeader('Content-Type', img.contentType || 'image/jpeg')
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="frame-${frameId}-${imageId}.jpg"`)
      res.setHeader('Cache-Control', 'no-store')
    } else {
      // Image ids never get overwritten (only added/deleted), so this is
      // safe to cache forever.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    res.end(buf)
  } catch (err) {
    console.error('[frames] stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}
