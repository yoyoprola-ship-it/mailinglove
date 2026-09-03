import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { saveFile, downloadFile, deleteFile, EXT } from './bucket.js'

// Calendar templates are admin-uploaded background images (the calendar
// grid + art is baked into the image). Each is a Firestore document with
// its image at calendar-templates/<id>.<ext> in the bucket — same model as
// the postcard catalog. The customer composes framed photos + styled text
// on top in the browser; the flattened result goes to the cart.
//
// calendarTemplates/<id> = {
//   id, name, storagePath, contentType, hidden, order, createdAt, updatedAt,
//   layout: { position:'bottom'|'side', ink, accent, titleFont, panel }
// }

const COLL = 'calendarTemplates'

const POSITIONS = ['bottom', 'side']
const PANELS = ['light', 'dark', 'none']
const FONTS = [
  'Playfair Display', 'Cormorant Garamond', 'Marcellus', 'Prata',
  'Cinzel', 'Great Vibes', 'Parisienne',
]
const DEFAULT_LAYOUT = {
  position: 'bottom',
  ink: '#2b2b2e',
  accent: '#b8355f',
  titleFont: 'Cinzel',
  panel: 'light',
}
const hex = (v, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback)

function validLayout(input) {
  const l = input && typeof input === 'object' ? input : {}
  return {
    position: POSITIONS.includes(l.position) ? l.position : DEFAULT_LAYOUT.position,
    ink: hex(l.ink, DEFAULT_LAYOUT.ink),
    accent: hex(l.accent, DEFAULT_LAYOUT.accent),
    titleFont: FONTS.includes(l.titleFont) ? l.titleFont : DEFAULT_LAYOUT.titleFont,
    panel: PANELS.includes(l.panel) ? l.panel : DEFAULT_LAYOUT.panel,
  }
}

let cache = null
let cacheAt = 0

export function invalidateTemplates() {
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
      console.warn('[cal-tpl] list failed:', err?.message || err)
    }
  }
  cache = rows
  cacheAt = Date.now()
  return rows
}

const pub = (t) => ({
  id: t.id,
  name: t.name,
  image: `/api/calendar-template-image/${t.id}?v=${t.updatedAt || 0}`,
  layout: validLayout(t.layout),
})

export async function listTemplates() {
  const rows = await listAll()
  return rows.filter((t) => !t.hidden).map(pub)
}

export async function adminListTemplates() {
  const rows = await listAll()
  return rows.map((t) => ({
    ...pub(t),
    hidden: Boolean(t.hidden),
    updatedAt: t.updatedAt || 0,
  }))
}

export async function getTemplate(id) {
  const db = getDb()
  if (!db || !id) return null
  try {
    const snap = await db.collection(COLL).doc(String(id)).get()
    return snap.exists ? snap.data() : null
  } catch (err) {
    console.warn('[cal-tpl] get failed:', err?.message || err)
    return null
  }
}

function checkImage(contentType) {
  const ext = EXT[contentType]
  if (!ext || ext === 'pdf') return null
  return ext
}

export async function addTemplate({ name, layout, buffer, contentType }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const nm = String(name || '').trim().slice(0, 80)
  if (!nm) return { ok: false, error: 'A name is required.' }
  const ext = checkImage(contentType)
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const id = crypto.randomBytes(8).toString('hex')
  const storagePath = `${COLL}/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)

  const rows = await listAll()
  const now = Date.now()
  const doc = {
    id,
    name: nm,
    storagePath,
    contentType,
    hidden: false,
    layout: validLayout(layout),
    order: (rows.reduce((m, t) => Math.max(m, t.order || 0), 0) || 0) + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection(COLL).doc(id).set(doc)
  invalidateTemplates()
  return { ok: true, template: pub(doc) }
}

export async function replaceTemplateImage(id, buffer, contentType) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown template.' }
  const ext = checkImage(contentType)
  if (!ext) return { ok: false, error: 'Use a JPEG, PNG, or WebP image.' }

  const prev = snap.data()
  const storagePath = `${COLL}/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)
  if (prev.storagePath && prev.storagePath !== storagePath) await deleteFile(prev.storagePath)
  const updatedAt = Date.now()
  await ref.set({ storagePath, contentType, updatedAt }, { merge: true })
  invalidateTemplates()
  return { ok: true, updatedAt }
}

export async function updateTemplate(id, patch = {}) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  if (!(await ref.get()).exists) return { ok: false, error: 'Unknown template.' }

  const set = { updatedAt: Date.now() }
  if (typeof patch.name === 'string') {
    const nm = patch.name.trim().slice(0, 80)
    if (!nm) return { ok: false, error: 'A name is required.' }
    set.name = nm
  }
  if (typeof patch.hidden === 'boolean') set.hidden = patch.hidden
  if (patch.layout) set.layout = validLayout(patch.layout)
  if (Object.keys(set).length === 1) return { ok: false, error: 'Nothing to update.' }

  await ref.set(set, { merge: true })
  invalidateTemplates()
  return { ok: true }
}

export async function deleteTemplate(id) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ref = db.collection(COLL).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Unknown template.' }
  const { storagePath } = snap.data()
  if (storagePath) await deleteFile(storagePath)
  await ref.delete()
  invalidateTemplates()
  return { ok: true }
}

export async function streamTemplateImage(id, res, { versioned = false } = {}) {
  const t = await getTemplate(id)
  if (!t || !t.storagePath) return res.status(404).end()
  try {
    const buf = await downloadFile(t.storagePath)
    res.setHeader('Content-Type', t.contentType || 'application/octet-stream')
    res.setHeader(
      'Cache-Control',
      versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=60'
    )
    res.end(buf)
  } catch (err) {
    console.error('[cal-tpl] stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}
