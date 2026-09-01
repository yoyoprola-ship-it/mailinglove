import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { sendEmail, emailConfigured } from './notify.js'
import { renderEmail } from './emailTemplate.js'
import { saveFile, downloadFile, EXT } from './bucket.js'

// One support conversation per customer, keyed by email. Messages live in an
// array on the doc (support chats are short); the oldest are trimmed past a
// cap. Firestore: supportThreads/<email>. Image attachments go to Cloud
// Storage under support/<token>.<ext>, with supportImages/<token> recording
// which thread they belong to so downloads can be authorized.

const MAX_MESSAGES = 300
const MAX_TEXT = 2000
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()

const clip = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '')
const preview = (t) => t.replace(/\s+/g, ' ').slice(0, 120)

function ref(email) {
  return getDb().collection('supportThreads').doc(email)
}

function shape(email, d) {
  return {
    email,
    userName: d.userName || '',
    status: d.status || 'open',
    messages: (d.messages || []).map((m) => ({
      id: m.id,
      from: m.from,
      text: m.text,
      at: m.at,
      image: m.image
        ? { token: m.image.token, contentType: m.image.contentType || 'image/jpeg' }
        : null,
    })),
    unreadForAdmin: Boolean(d.unreadForAdmin),
    unreadForUser: Boolean(d.unreadForUser),
    updatedAt: d.updatedAt || d.createdAt || 0,
    lastMessagePreview: d.lastMessagePreview || '',
  }
}

export async function saveSupportImage(email, buffer, contentType) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Support is unavailable right now.' }
  const ext = EXT[contentType]
  if (!ext || !['jpg', 'png', 'webp'].includes(ext)) {
    return { ok: false, error: 'Attach a JPEG, PNG, or WebP image.' }
  }
  const token = crypto.randomBytes(12).toString('hex')
  const path = `support/${token}.${ext}`
  await saveFile(path, buffer, contentType)
  await db
    .collection('supportImages')
    .doc(token)
    .set({ token, path, contentType, email, createdAt: Date.now() })
  return { ok: true, image: { token, contentType } }
}

export async function getSupportImage(token) {
  const db = getDb()
  if (!db) return null
  const snap = await db.collection('supportImages').doc(String(token)).get()
  return snap.exists ? snap.data() : null
}

export async function streamSupportImage(entry, res) {
  try {
    const buf = await downloadFile(entry.path)
    res.setHeader('Content-Type', entry.contentType || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.end(buf)
  } catch (err) {
    console.error('[support] image stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}

export async function getThread(email) {
  const snap = await ref(email).get()
  if (!snap.exists) return null
  return shape(email, snap.data())
}

async function append(email, { from, text, userName, image }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Support is unavailable right now.' }
  const body = clip(text)
  if (!body && !image) return { ok: false, error: 'Type a message or attach an image.' }

  const r = ref(email)
  const snap = await r.get()
  const now = Date.now()
  const msg = { id: crypto.randomBytes(6).toString('hex'), from, text: body, at: now }
  if (image) msg.image = { token: image.token, contentType: image.contentType || 'image/jpeg' }

  const base = snap.exists ? snap.data() : { email, createdAt: now, status: 'open', messages: [] }
  const messages = [...(base.messages || []), msg].slice(-MAX_MESSAGES)

  const doc = {
    ...base,
    email,
    userName: userName || base.userName || '',
    messages,
    updatedAt: now,
    lastMessageAt: now,
    lastMessageFrom: from,
    lastMessagePreview: preview(body || '📷 Photo'),
    unreadForAdmin: from === 'user' ? true : base.unreadForAdmin || false,
    unreadForUser: from === 'admin' ? true : base.unreadForUser || false,
    status: from === 'admin' && base.status === 'closed' ? 'closed' : base.status || 'open',
  }
  await r.set(doc, { merge: true })
  return { ok: true, thread: shape(email, doc) }
}

export async function postUserMessage(email, userName, text, image) {
  const res = await append(email, { from: 'user', text, userName, image })
  if (res.ok && emailConfigured() && ADMIN_EMAIL) {
    const line = clip(text) || (image ? '(sent a photo — open the chat to view it)' : '')
    sendEmail(
      ADMIN_EMAIL,
      `Support message from ${userName || email}`,
      renderEmail({
        preheader: line.slice(0, 120),
        title: 'New support message',
        blocks: [
          { rows: [['From', `${userName ? userName + ' ' : ''}${email}`]] },
          { quote: line },
        ],
        cta: { label: 'Open the admin panel', href: 'https://mailinglove.com/admin' },
      })
    ).catch((err) => console.error('[support] admin notify failed:', err?.message || err))
  }
  return res
}

export async function postAdminMessage(email, text, image) {
  const res = await append(email, { from: 'admin', text, image })
  if (res.ok && emailConfigured()) {
    const line = clip(text) || (image ? '(a photo — open the chat to view it)' : '')
    sendEmail(
      email,
      'Reply from MailingLove support',
      renderEmail({
        preheader: line.slice(0, 120),
        title: 'You have a reply from support',
        blocks: [
          { p: 'Our team replied to your message:' },
          { quote: line },
        ],
        cta: { label: 'Open the chat', href: 'https://mailinglove.com' },
      })
    ).catch((err) => console.error('[support] user notify failed:', err?.message || err))
  }
  return res
}

export async function markRead(email, side) {
  const db = getDb()
  if (!db) return
  const patch = side === 'admin' ? { unreadForAdmin: false } : { unreadForUser: false }
  await ref(email).set(patch, { merge: true }).catch(() => {})
}

export async function setThreadStatus(email, status) {
  const db = getDb()
  if (!db) return { ok: false }
  if (!['open', 'closed'].includes(status)) return { ok: false, error: 'Bad status.' }
  await ref(email).set({ status, updatedAt: Date.now() }, { merge: true })
  return { ok: true }
}

export async function listThreads() {
  const db = getDb()
  if (!db) return []
  const snap = await db
    .collection('supportThreads')
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get()
  return snap.docs.map((doc) => {
    const d = doc.data()
    return {
      email: doc.id,
      userName: d.userName || '',
      status: d.status || 'open',
      updatedAt: d.updatedAt || d.createdAt || 0,
      lastMessagePreview: d.lastMessagePreview || '',
      lastMessageFrom: d.lastMessageFrom || '',
      unreadForAdmin: Boolean(d.unreadForAdmin),
      messageCount: (d.messages || []).length,
    }
  })
}

export async function adminUnreadCount() {
  const list = await listThreads()
  return list.filter((t) => t.unreadForAdmin).length
}
