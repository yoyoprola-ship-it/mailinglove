import { getDb } from './firebaseAdmin.js'

// Runtime config = env defaults, overridden by the Firestore doc config/app
// that the admin panel edits. Cached briefly so /api/generate doesn't read
// Firestore on every request.

const DEFAULTS = {
  generateEnabled: true,
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5',
  imageQuality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
  imageSize: process.env.OPENAI_IMAGE_SIZE || '1024x1536',
  inputFidelity: process.env.OPENAI_IMAGE_INPUT_FIDELITY ?? 'high',
  rateLimitMax: 5,
  rateLimitWindowMin: 15,
}

// What the admin form is allowed to set, with validation.
export const CONFIG_FIELDS = {
  generateEnabled: { type: 'bool' },
  imageModel: {
    type: 'enum',
    values: ['gpt-image-1-mini', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'],
  },
  imageQuality: { type: 'enum', values: ['low', 'medium', 'high', 'auto'] },
  imageSize: {
    type: 'enum',
    values: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
  },
  inputFidelity: { type: 'enum', values: ['high', 'low', ''] },
  rateLimitMax: { type: 'int', min: 1, max: 100 },
  rateLimitWindowMin: { type: 'int', min: 1, max: 1440 },
}

let cache = null
let cacheAt = 0
const TTL_MS = 30_000

export async function getConfig() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache
  let stored = {}
  const db = getDb()
  if (db) {
    try {
      const snap = await db.collection('config').doc('app').get()
      if (snap.exists) stored = snap.data() || {}
    } catch (err) {
      console.warn('[config] read failed, using defaults:', err?.message || err)
    }
  }
  cache = { ...DEFAULTS, ...pickValid(stored) }
  cacheAt = Date.now()
  return cache
}

export function invalidateConfigCache() {
  cache = null
}

// Coerce + validate an incoming partial config (from the admin form or the
// stored doc). Unknown keys and bad values are dropped.
export function pickValid(input) {
  const out = {}
  for (const [key, rule] of Object.entries(CONFIG_FIELDS)) {
    if (!(key in input)) continue
    const v = input[key]
    if (rule.type === 'bool' && typeof v === 'boolean') out[key] = v
    else if (rule.type === 'enum' && rule.values.includes(v)) out[key] = v
    else if (rule.type === 'int') {
      const n = Math.trunc(Number(v))
      if (Number.isFinite(n) && n >= rule.min && n <= rule.max) out[key] = n
    }
  }
  return out
}

export { DEFAULTS as CONFIG_DEFAULTS }
