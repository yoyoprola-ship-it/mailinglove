import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { sendEmail, emailConfigured } from './notify.js'
import {
  sixDigits,
  hashCode,
  safeEqualHex,
  signToken,
  verifyToken,
  readCookie,
  buildCookie,
} from './session.js'

// Customer accounts: email-code login (one 6-digit code by email), a signed
// session cookie, and a US delivery-address profile. Signs with
// ADMIN_SESSION_SECRET but scopes the token with aud:'user' so an admin
// cookie can't be replayed here and vice versa.

const SECRET = process.env.ADMIN_SESSION_SECRET || ''
const CHALLENGE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_ATTEMPTS = 5
const COOKIE = 'ml_session'
const AUD = 'user'

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
])

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const normEmail = (s) => String(s).trim().toLowerCase()

export function userAuthConfigured() {
  return Boolean(SECRET && emailConfigured() && getDb())
}

export async function startUserChallenge(email) {
  if (!isEmail(email)) return { ok: false, error: 'Enter a valid email.' }
  const db = getDb()
  const challengeId = crypto.randomBytes(16).toString('hex')
  const code = sixDigits()

  await db.collection('authChallenges').doc(challengeId).set({
    email: normEmail(email),
    codeHash: hashCode(SECRET, challengeId, code),
    attempts: 0,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    createdAt: Date.now(),
  })

  await sendEmail(
    normEmail(email),
    'Your MailingLove sign-in code',
    `Your sign-in code is ${code}. It is valid for 10 minutes.\n\n` +
      `If you did not request this, you can ignore this email.`
  )

  return { ok: true, challengeId }
}

export async function verifyUserChallenge(challengeId, code) {
  const db = getDb()
  if (!challengeId || !code) return { ok: false, error: 'Missing code.' }
  const ref = db.collection('authChallenges').doc(String(challengeId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Code expired — request a new one.' }
  const c = snap.data()

  if (Date.now() > c.expiresAt) {
    await ref.delete().catch(() => {})
    return { ok: false, error: 'Code expired — request a new one.' }
  }
  if (c.attempts >= MAX_ATTEMPTS) {
    await ref.delete().catch(() => {})
    return { ok: false, error: 'Too many attempts — request a new one.' }
  }
  if (!safeEqualHex(c.codeHash, hashCode(SECRET, challengeId, String(code).trim()))) {
    await ref.update({ attempts: (c.attempts || 0) + 1 }).catch(() => {})
    return { ok: false, error: 'Wrong code.', remaining: MAX_ATTEMPTS - (c.attempts + 1) }
  }

  await ref.delete().catch(() => {})
  const user = await ensureUser(c.email)
  return { ok: true, token: signToken(SECRET, { sub: c.email, aud: AUD }, SESSION_TTL_MS), user }
}

async function ensureUser(email) {
  const db = getDb()
  const ref = db.collection('users').doc(email)
  const snap = await ref.get()
  if (!snap.exists) {
    const doc = { email, name: '', address: null, createdAt: Date.now(), updatedAt: Date.now() }
    await ref.set(doc)
    return publicUser(doc)
  }
  return publicUser(snap.data())
}

export async function getUser(email) {
  const db = getDb()
  const snap = await db.collection('users').doc(email).get()
  return snap.exists ? publicUser(snap.data()) : null
}

export async function saveProfile(email, input, meta = {}) {
  const { value, errors } = validateProfile(input)
  if (errors.length) return { ok: false, errors }
  const db = getDb()
  const ref = db.collection('users').doc(email)

  const prevSnap = await ref.get()
  const prev = prevSnap.exists ? prevSnap.data() : {}
  const before = { name: prev.name || '', address: prev.address || null }
  const after = { name: value.name || '', address: value.address || null }

  await ref.set({ ...value, updatedAt: Date.now() }, { merge: true })

  if (JSON.stringify(before) !== JSON.stringify(after)) {
    const { logChange } = await import('./audit.js')
    logChange({ email, kind: 'profile.update', before, after, ip: meta.ip, userAgent: meta.userAgent })
  }
  return { ok: true, user: await getUser(email) }
}

// --- validation --------------------------------------------------------

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

// Validate + normalize a US address. Returns { errors, value }. `label`
// prefixes error messages ("Recipient street address is required").
export function validateAddress(a = {}, label = '') {
  const errors = []
  const p = label ? `${label} ` : ''
  const line1 = str(a.line1, 200)
  const line2 = str(a.line2, 200)
  const city = str(a.city, 100)
  const state = str(a.state, 2).toUpperCase()
  const zip = str(a.zip, 10)

  if (!line1) errors.push(`${p}street address is required.`)
  if (!city) errors.push(`${p}city is required.`)
  if (!US_STATES.has(state)) errors.push(`Pick a valid ${p ? p.toLowerCase() : ''}US state.`)
  if (!/^\d{5}(-\d{4})?$/.test(zip)) errors.push(`${p}ZIP must be 5 digits (or ZIP+4).`)

  return { errors, value: { line1, line2, city, state, zip, country: 'US' } }
}

export function validateProfile(input = {}) {
  const name = str(input.name, 120)
  const { errors, value: address } = validateAddress(input.address || {})
  if (!name) errors.unshift('Name is required.')
  return { errors, value: { name, address } }
}

// --- session / middleware --------------------------------------------

function publicUser(d) {
  return { email: d.email, name: d.name || '', address: d.address || null }
}

export function userSessionCookie(token, secure) {
  return buildCookie(COOKIE, token, { ttlMs: SESSION_TTL_MS, secure })
}

export function clearUserCookie(secure) {
  return buildCookie(COOKIE, '', { ttlMs: 0, secure })
}

export function requireUser(req, res, next) {
  const session = verifyToken(SECRET, readCookie(req, COOKIE))
  if (!session || session.aud !== AUD) return res.status(401).json({ error: 'Not signed in.' })
  req.userEmail = session.sub
  next()
}
