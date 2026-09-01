import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { sendSms, sendEmail, smsConfigured, emailConfigured } from './notify.js'
import { renderEmail } from './emailTemplate.js'
import {
  sixDigits,
  hashCode,
  safeEqualHex,
  signToken,
  verifyToken,
  readCookie,
  buildCookie,
} from './session.js'

const SECRET = process.env.ADMIN_SESSION_SECRET || ''
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '').trim()

const CHALLENGE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
const COOKIE = 'admin_session'
const AUD = 'admin'

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

export async function startChallenge() {
  const db = getDb()
  const challengeId = crypto.randomBytes(16).toString('hex')
  const emailCode = sixDigits()
  const smsCode = sixDigits()

  await db
    .collection('adminChallenges')
    .doc(challengeId)
    .set({
      emailHash: hashCode(SECRET, challengeId, emailCode),
      smsHash: hashCode(SECRET, challengeId, smsCode),
      attempts: 0,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
      createdAt: Date.now(),
    })

  await Promise.all([
    sendSms(ADMIN_PHONE, `${smsCode} is your MailingLove admin code (valid 10 min)`),
    sendEmail(
      ADMIN_EMAIL,
      `${emailCode} — MailingLove admin verification`,
      renderEmail({
        preheader: `Email code ${emailCode} — valid for 10 minutes.`,
        title: 'Admin sign-in verification',
        blocks: [
          { p: 'Use this email code together with the code sent to your phone. Both expire in 10 minutes.' },
          { code: emailCode },
          { small: "If you didn't try to sign in to the admin panel, ignore this message and consider changing your credentials." },
        ],
      })
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

  const emailOk = safeEqualHex(c.emailHash, hashCode(SECRET, challengeId, String(emailCode).trim()))
  const smsOk = safeEqualHex(c.smsHash, hashCode(SECRET, challengeId, String(smsCode).trim()))
  if (!emailOk || !smsOk) {
    await ref.update({ attempts: (c.attempts || 0) + 1 }).catch(() => {})
    return { ok: false, error: 'Wrong code(s).', remaining: MAX_ATTEMPTS - (c.attempts + 1) }
  }

  await ref.delete().catch(() => {})
  return { ok: true, token: signToken(SECRET, { sub: ADMIN_EMAIL, aud: AUD }, SESSION_TTL_MS) }
}

export function sessionCookie(token, secure) {
  return buildCookie(COOKIE, token, { ttlMs: SESSION_TTL_MS, secure })
}

export function clearCookie(secure) {
  return buildCookie(COOKIE, '', { ttlMs: 0, secure })
}

export function requireAdmin(req, res, next) {
  const session = verifyToken(SECRET, readCookie(req, COOKIE))
  if (!session || session.aud !== AUD) return res.status(401).json({ error: 'Not signed in.' })
  req.adminEmail = session.sub
  next()
}
