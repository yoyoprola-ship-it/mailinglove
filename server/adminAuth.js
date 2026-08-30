import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { sendSms, sendEmail, smsConfigured, emailConfigured } from './notify.js'

const SECRET = process.env.ADMIN_SESSION_SECRET || ''
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '').trim()

const CHALLENGE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
const COOKIE = 'admin_session'

export function adminConfigured() {
  return Boolean(SECRET && ADMIN_EMAIL && ADMIN_PHONE && smsConfigured() && emailConfigured() && getDb())
}

// Reason strings for a 503 when something's missing — handy while setting up.
export function adminSetupIssues() {
  const missing = []
  if (!SECRET) missing.push('ADMIN_SESSION_SECRET')
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL')
  if (!ADMIN_PHONE) missing.push('ADMIN_PHONE')
  if (!smsConfigured()) missing.push('Twilio (TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM)')
  if (!emailConfigured()) missing.push('Resend (RESEND_API_KEY/RESEND_FROM)')
  if (!getDb()) missing.push('firebase-admin credentials')
  return missing
}

function sixDigits() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function hashCode(challengeId, code) {
  return crypto.createHmac('sha256', SECRET).update(`${challengeId}:${code}`).digest('hex')
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex')
  const bb = Buffer.from(String(b), 'hex')
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export async function startChallenge() {
  const db = getDb()
  const challengeId = crypto.randomBytes(16).toString('hex')
  const emailCode = sixDigits()
  const smsCode = sixDigits()

  await db
    .collection('adminChallenges')
    .doc(challengeId)
    .set({
      emailHash: hashCode(challengeId, emailCode),
      smsHash: hashCode(challengeId, smsCode),
      attempts: 0,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
      createdAt: Date.now(),
    })

  await Promise.all([
    sendSms(ADMIN_PHONE, `MailingLove admin code: ${smsCode} (valid 10 min)`),
    sendEmail(
      ADMIN_EMAIL,
      'MailingLove admin login code',
      `Your email verification code is ${emailCode}. It is valid for 10 minutes.\n\n` +
        `If you did not try to sign in, ignore this message.`
    ),
  ])

  return { challengeId, expiresInSec: CHALLENGE_TTL_MS / 1000 }
}

export async function verifyChallenge(challengeId, emailCode, smsCode) {
  const db = getDb()
  if (!challengeId || !emailCode || !smsCode) return { ok: false, error: 'Missing codes.' }
  const ref = db.collection('adminChallenges').doc(String(challengeId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Login expired — start again.' }
  const c = snap.data()

  if (Date.now() > c.expiresAt) {
    await ref.delete().catch(() => {})
    return { ok: false, error: 'Login expired — start again.' }
  }
  if (c.attempts >= MAX_ATTEMPTS) {
    await ref.delete().catch(() => {})
    return { ok: false, error: 'Too many attempts — start again.' }
  }

  const emailOk = safeEqualHex(c.emailHash, hashCode(challengeId, String(emailCode).trim()))
  const smsOk = safeEqualHex(c.smsHash, hashCode(challengeId, String(smsCode).trim()))
  if (!emailOk || !smsOk) {
    await ref.update({ attempts: (c.attempts || 0) + 1 }).catch(() => {})
    return { ok: false, error: 'Wrong code(s).', remaining: MAX_ATTEMPTS - (c.attempts + 1) }
  }

  await ref.delete().catch(() => {})
  return { ok: true, token: makeSession(ADMIN_EMAIL) }
}

// --- session token: base64url(payload).base64url(hmac) ---

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

export function makeSession(email) {
  const payload = b64url(JSON.stringify({ sub: email, exp: Date.now() + SESSION_TTL_MS }))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
  return `${payload}.${sig}`
}

export function verifySession(token) {
  if (!token || !SECRET) return null
  const [payload, sig] = String(token).split('.')
  if (!payload || !sig) return null
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

export function sessionCookie(token, secure) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_MS / 1000}`,
  ]
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

export function clearCookie(secure) {
  const bits = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0']
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

export function requireAdmin(req, res, next) {
  const session = verifySession(readCookie(req))
  if (!session) return res.status(401).json({ error: 'Not signed in.' })
  req.adminEmail = session.sub
  next()
}
