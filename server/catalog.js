import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDb } from './firebaseAdmin.js'
import { saveFile, deleteFile, EXT } from './bucket.js'

// Every postcard is a document in the Firestore `postcards` collection, and
// its image is a single object in Cloud Storage (postcards/<id>.<ext>).
// Cropping or replacing overwrites that object and bumps `updatedAt`; the
// storefront URL carries ?v=<updatedAt> so a replacement is picked up
// everywhere at once. No static files, no override map.
//
// postcards/<id> = {
//   id, type, subcategory|null, title,
//   storagePath, contentType, hidden, order, createdAt, updatedAt
// }
//
// Categories (types + their subcategories) stay static — see src/data.

const typesPath = fileURLToPath(new URL('../src/data/postcards.json', import.meta.url))
const base = JSON.parse(readFileSync(typesPath, 'utf8'))
export const catalog = { types: base.types }

const COLL = 'postcards'

// --- cached full list ------------------------------------------------

let cache = null
let cacheAt = 0

export function invalidateCatalog() {
  cache = null
}

async function listAll() {
  if (cache && Date.now() - cacheAt < 30_000) return cache
  const db = getDb()
  let rows = []
  if (db) {
    try {
      const snap = await db.collection(COLL).get()
      rows = snap.docs
        .map((d) => d.data())
        .sort((a, b) => (a.order || 0) - (b.order || 0))
    } catch (err) {
      console.warn('[catalog] list failed:', err?.message || err)
    }
  }
  cache = rows
  cacheAt = Date.now()
  return rows
}

// --- projections ---------------------------------------------------

const publicCard = (p) => ({
  id: p.id,
  type: p.type,
  subcategory: p.subcategory || null,
  title: p.title,
  image: `/api/postcard-image/${p.id}?v=${p.updatedAt || 0}`,
})

// Storefront catalog: visible cards only.
export async function getMergedCatalog() {
  const rows = await listAll()
  const postcards = rows.filter((p) => !p.hidden).map(publicCard)

  // Safety net during/after the one-time migration: if the collection is
  // empty, fall back to the bundled list so the storefront is never blank.
  if (!postcards.length && Array.isArray(base.postcards) && base.postcards.length) {
    return {
      types: base.types,
      postcards: base.postcards.map((p) => ({
        id: p.id,
        type: p.type,
        subcategory: p.subcategory || null,
        title: p.title,
        image: `/api/postcard-image/${p.id}`,
      })),
    }
  }
  return { types: base.types, postcards }
}

// Single card — read straight from Firestore so image streaming and cart
// snapshots always see the current storagePath / updatedAt.
export async function getPostcard(id) {
  const db = getDb()
  if (!db || !id) return null
  try {
    const snap = await db.collection(COLL).doc(String(id)).get()
    if (snap.exists) return snap.data()
  } catch (err) {
    console.warn('[catalog] getPostcard failed:', err?.message || err)
  }
  // migration fallback
  const b = base.postcards?.find((p) => p.id === id)
  return b ? { ...b, storagePath: null } : null
}

// Admin gallery: every card, hidden included.
export async function adminList() {
  const rows = await listAll()
  return rows.map((p) => ({
    id: p.id,
    type: p.type,
    subcategory: p.subcategory || null,
    title: p.title,
    image: `/api/postcard-image/${p.id}?v=${p.updatedAt || 0}`,
    hidden: Boolean(p.hidden),
    updatedAt: p.updatedAt || 0,
  }))
}

// --- writes ------------------------------------------------------

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'card'

function checkImage(contentType) {
  const ext = EXT[contentType]
  if (!ext || ext === 'pdf') return null
  return ext
}

export async function addPostcard({ type, subcategory, title, buffer, contentType }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }

  const t = base.types.find((x) => x.id === type)
  if (!t) return { ok: false, error: 'Pick a valid category.' }
  if (subcategory && !t.subcategories.some((s) => s.id === subcategory)) {
    return { ok: false, error: 'Pick a valid subcategory.' }
  }
  const ttl = String(title || '').trim().slice(0, 120)
  if (!ttl) return { ok: false, error: 'A title is required.' }
  const ext = checkImage(contentType)
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const id = `${slugify(ttl)}-${crypto.randomBytes(3).toString('hex')}`
  const storagePath = `${COLL}/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)

  const rows = await listAll()
  const now = Date.now()
  const doc = {
    id,
    type,
    subcategory: subcategory || null,
    title: ttl,
    storagePath,
    contentType,
    hidden: false,
    order: (rows.reduce((m, p) => Math.max(m, p.order || 0), 0) || 0) + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection(COLL).doc(id).set(doc)
  invalidateCatalog()
  return { ok: true, card: publicCard(doc) }
}

// Crop and "Replace" both land here: overwrite the card's image object.
export async function replacePostcardImage(id, buffer, contentType) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown postcard.' }
  const ext = checkImage(contentType)
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const prev = snap.data()
  const storagePath = `${COLL}/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)
  if (prev.storagePath && prev.storagePath !== storagePath) {
    await deleteFile(prev.storagePath)
  }
  const updatedAt = Date.now()
  await ref.set({ storagePath, contentType, updatedAt }, { merge: true })
  invalidateCatalog()
  return { ok: true, updatedAt }
}

export async function setPostcardHidden(id, hidden) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown postcard.' }
  await ref.set({ hidden: Boolean(hidden), updatedAt: Date.now() }, { merge: true })
  invalidateCatalog()
  return { ok: true }
}

// Permanent: the document and its image object are gone for good.
export async function deletePostcard(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown postcard.' }
  const { storagePath } = snap.data()
  if (storagePath) await deleteFile(storagePath)
  await ref.delete()
  invalidateCatalog()
  return { ok: true }
}
