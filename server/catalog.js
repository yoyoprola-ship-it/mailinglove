import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from './firebaseAdmin.js'
import { saveFile, deleteFile, EXT } from './bucket.js'

// Base catalog: src/data/postcards.json, bundled with the frontend and the
// seed for the server. The admin panel can extend it (new cards, images in
// Cloud Storage) or hide base cards; those edits live in Firestore
// (config/catalog) and are merged in here at runtime — no rebuild needed.
const path = fileURLToPath(new URL('../src/data/postcards.json', import.meta.url))
const base = JSON.parse(readFileSync(path, 'utf8'))

// Types (and their subcategories) stay static — only individual cards are
// editable at runtime.
export const catalog = base

let cache = null
let cacheAt = 0

async function overlay() {
  if (cache && Date.now() - cacheAt < 20_000) return cache
  let o = { added: [], removed: [] }
  const db = getDb()
  if (db) {
    try {
      const snap = await db.collection('config').doc('catalog').get()
      if (snap.exists) {
        const d = snap.data() || {}
        o = {
          added: Array.isArray(d.added) ? d.added : [],
          removed: Array.isArray(d.removed) ? d.removed : [],
        }
      }
    } catch (err) {
      console.warn('[catalog] overlay read failed:', err?.message || err)
    }
  }
  cache = o
  cacheAt = Date.now()
  return o
}

export function invalidateCatalog() {
  cache = null
}

const publicCard = (p) => ({
  id: p.id,
  type: p.type,
  subcategory: p.subcategory || null,
  title: p.title,
  image: p.image,
})

// Storefront catalog: base cards minus hidden ones, plus admin-created cards.
export async function getMergedCatalog() {
  const { added, removed } = await overlay()
  const hidden = new Set(removed)
  const postcards = [...base.postcards.filter((p) => !hidden.has(p.id)), ...added].map(publicCard)
  return { types: base.types, postcards }
}

// Resolve a single card for order snapshots / image streaming. Returns the
// raw object (admin-created cards also carry storagePath/contentType).
// Hidden base cards resolve to null — they can't be added to a cart.
export async function getPostcard(id) {
  const { added, removed } = await overlay()
  if (removed.includes(id)) return null
  return base.postcards.find((p) => p.id === id) || added.find((p) => p.id === id) || null
}

// Full list for the admin gallery: every base card (flagged hidden or not)
// plus every admin-created card.
export async function adminList() {
  const { added, removed } = await overlay()
  const hidden = new Set(removed)
  return [
    ...base.postcards.map((p) => ({ ...publicCard(p), custom: false, hidden: hidden.has(p.id) })),
    ...added.map((p) => ({ ...publicCard(p), custom: true, hidden: false })),
  ]
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'card'

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
  const ext = EXT[contentType]
  if (!ext || ext === 'pdf') return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const id = `custom-${slugify(ttl)}-${crypto.randomBytes(3).toString('hex')}`
  const storagePath = `postcards-custom/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)

  const card = {
    id,
    type,
    subcategory: subcategory || null,
    title: ttl,
    image: `/api/postcard-image/${id}`,
    storagePath,
    contentType,
    createdAt: Date.now(),
  }
  await db
    .collection('config')
    .doc('catalog')
    .set({ added: FieldValue.arrayUnion(card) }, { merge: true })
  invalidateCatalog()
  return { ok: true, card: publicCard(card) }
}

export async function deletePostcard(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }

  const { added } = await overlay()
  const custom = added.find((p) => p.id === id)
  if (custom) {
    if (custom.storagePath) await deleteFile(custom.storagePath)
    await db
      .collection('config')
      .doc('catalog')
      .set({ added: FieldValue.arrayRemove(custom) }, { merge: true })
  } else if (base.postcards.some((p) => p.id === id)) {
    await db
      .collection('config')
      .doc('catalog')
      .set({ removed: FieldValue.arrayUnion(id) }, { merge: true })
  } else {
    return { ok: false, error: 'Unknown postcard.' }
  }
  invalidateCatalog()
  return { ok: true }
}

export async function restorePostcard(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  await db
    .collection('config')
    .doc('catalog')
    .set({ removed: FieldValue.arrayRemove(id) }, { merge: true })
  invalidateCatalog()
  return { ok: true }
}
