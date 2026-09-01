import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { sendEmail, emailConfigured } from './notify.js'

// One support conversation per customer, keyed by email. Messages live in an
// array on the doc (support chats are short); the oldest are trimmed past a
// cap. Firestore: supportThreads/<email>.

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
    })),
    unreadForAdmin: Boolean(d.unreadForAdmin),
    unreadForUser: Boolean(d.unreadForUser),
    updatedAt: d.updatedAt || d.createdAt || 0,
    lastMessagePreview: d.lastMessagePreview || '',
  }
}

export async function getThread(email) {
  const snap = await ref(email).get()
  if (!snap.exists) return null
  return shape(email, snap.data())
}

async function append(email, { from, text, userName }) {
  const db = getDb()
  if (!db) return { ok: false, error: 'Support is unavailable right now.' }
  const body = clip(text)
  if (!body) return { ok: false, error: 'Type a message first.' }

  const r = ref(email)
  const snap = await r.get()
  const now = Date.now()
  const msg = { id: crypto.randomBytes(6).toString('hex'), from, text: body, at: now }

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
    lastMessagePreview: preview(body),
    unreadForAdmin: from === 'user' ? true : base.unreadForAdmin || false,
    unreadForUser: from === 'admin' ? true : base.unreadForUser || false,
    status: from === 'admin' && base.status === 'closed' ? 'closed' : base.status || 'open',
  }
  await r.set(doc, { merge: true })
  return { ok: true, thread: shape(email, doc) }
}

export async function postUserMessage(email, userName, text) {
  const res = await append(email, { from: 'user', text, userName })
  if (res.ok && emailConfigured() && ADMIN_EMAIL) {
    sendEmail(
      ADMIN_EMAIL,
      `Support message from ${userName || email}`,
      `${userName ? userName + ' ' : ''}<${email}> wrote:\n\n${clip(text)}\n\n` +
        `Reply in the admin panel → Support.`
    ).catch((err) => console.error('[support] admin notify failed:', err?.message || err))
  }
  return res
}

export async function postAdminMessage(email, text) {
  const res = await append(email, { from: 'admin', text })
  if (res.ok && emailConfigured()) {
    sendEmail(
      email,
      'Reply from MailingLove support',
      `We replied to your support message:\n\n${clip(text)}\n\n` +
        `Open the chat on mailinglove.com to continue the conversation.`
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
