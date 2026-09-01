import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { saveFile, downloadFile, EXT } from './bucket.js'

// A "photo print" is a finished image the customer composed in the browser
// (cropped to a format, text baked in) and is buying a physical print of.
// The rendered file lives in Cloud Storage under photo-prints/<id>.<ext>;
// a Firestore doc photoPrints/<id> records who owns it so the image proxy
// can authorize downloads.

export const PHOTO_MAX_BYTES = 25 * 1024 * 1024 // 25 MB rendered result

export async function savePhotoPrint({ email, buffer, contentType }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Storage is not available right now.' }
  const ext = EXT[contentType]
  if (!ext || (ext !== 'jpg' && ext !== 'png')) {
    return { ok: false, error: 'The rendered image must be a JPEG or PNG.' }
  }
  const id = crypto.randomBytes(10).toString('hex')
  const storagePath = `photo-prints/${id}.${ext}`
  await saveFile(storagePath, buffer, contentType)
  await db
    .collection('photoPrints')
    .doc(id)
    .set({ id, storagePath, contentType, userEmail: email, createdAt: Date.now() })
  return { ok: true, id, storagePath, contentType }
}

export async function getPhotoPrint(id) {
  const db = getDb()
  if (!db) return null
  const snap = await db.collection('photoPrints').doc(String(id)).get()
  return snap.exists ? snap.data() : null
}

export async function streamPhotoPrint(entry, res) {
  try {
    const buf = await downloadFile(entry.storagePath)
    res.setHeader('Content-Type', entry.contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.end(buf)
  } catch (err) {
    console.error('[photo] stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}
