import crypto from 'node:crypto'

// Shared primitives for the admin 2FA login and the customer email-code
// login: 6-digit codes, HMAC hashing, and stateless signed session tokens
// (base64url(payload).base64url(hmac)). Both flows sign with
// ADMIN_SESSION_SECRET but scope tokens with a distinct `aud`.

export function sixDigits() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function hashCode(secret, challengeId, code) {
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex')
}

export function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex')
  const bb = Buffer.from(String(b), 'hex')
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export function signToken(secret, claims, ttlMs) {
  const payload = b64url(JSON.stringify({ ...claims, exp: Date.now() + ttlMs }))
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest())
  return `${payload}.${sig}`
}

export function verifyToken(secret, token) {
  if (!token || !secret) return null
  const [payload, sig] = String(token).split('.')
  if (!payload || !sig) return null
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest())
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

export function readCookie(req, name) {
  const raw = req.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

export function buildCookie(name, value, { ttlMs, secure }) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.round((value ? ttlMs : 0) / 1000)}`,
  ]
  if (secure) bits.push('Secure')
  return bits.join('; ')
}
