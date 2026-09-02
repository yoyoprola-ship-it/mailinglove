import { getDb } from './firebaseAdmin.js'

// Runtime config = env defaults, overridden by the Firestore doc config/app
// that the admin panel edits. Two fully independent groups — `photo` (the
// upload-a-photo redesign) and `postcard` (the name+category generator) —
// each with its own model / quality / rate limit. Cached briefly.

const MODELS = ['gpt-image-1-mini', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2']
const QUALITIES = ['low', 'medium', 'high', 'auto']
const API_SIZES = ['1024x1024', '1024x1536', '1536x1024', 'auto']
const FIDELITY = ['high', 'low', '']

const envModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5'
const envQuality = process.env.OPENAI_IMAGE_QUALITY || 'medium'
const envSize = process.env.OPENAI_IMAGE_SIZE || '1024x1536'
const envFidelity = process.env.OPENAI_IMAGE_INPUT_FIDELITY ?? 'high'

const DEFAULT_POSTCARD_SIZES = [
  { id: '4x6', label: '4×6 in — vertical', api: '1024x1536', priceCents: 299 },
  { id: '6x4', label: '6×4 in — horizontal', api: '1536x1024', priceCents: 299 },
  { id: '4x4', label: '4×4 in — square', api: '1024x1024', priceCents: 249 },
]

// Print-your-own-photo formats. w/h are inches — they set the crop aspect
// ratio and the 300 DPI target the browser renders at. priceCents is what
// that format costs in the cart. Split by what they mail in: small prints
// fold-free into a standard #10 envelope; anything bigger needs a flat
// catalog envelope.
const DEFAULT_PHOTO_FORMATS_10 = [
  { id: '4x6', label: '4×6 in', w: 4, h: 6, priceCents: 129 },
  { id: 'wallet', label: 'Wallet — 2.5 × 3.5 in', w: 2.5, h: 3.5, priceCents: 99 },
  { id: '4x4', label: '4×4 in — square', w: 4, h: 4, priceCents: 199 },
]
const DEFAULT_PHOTO_FORMATS_CATALOG = [
  { id: '5x7', label: '5×7 in', w: 5, h: 7, priceCents: 299 },
  { id: '8x10', label: '8×10 in', w: 8, h: 10, priceCents: 599 },
]

const DEFAULTS = {
  photo: {
    enabled: true,
    model: envModel,
    quality: envQuality,
    size: envSize,
    inputFidelity: envFidelity,
    rateLimitMax: 5,
  },
  postcard: {
    enabled: true,
    model: envModel,
    quality: envQuality,
    rateLimitMax: 5,
    perPage: 25, // ready-made gallery page size
    sizes: DEFAULT_POSTCARD_SIZES,
  },
  orders: {
    postcardPriceCents: 500, // USD price per printed+mailed postcard — set the real value in the admin
    originZip: '', // ZIP everything is printed & mailed from (for delivery estimates)
  },
  photoprint: {
    enabled: false, // off until the admin sets real prices
    formats10: DEFAULT_PHOTO_FORMATS_10,
    formatsCatalog: DEFAULT_PHOTO_FORMATS_CATALOG,
  },
}

export const CURRENCY = 'usd'

// Drives the admin form and validation. `general`-less: every field lives
// under one of the two panels.
export const CONFIG_SCHEMA = {
  photo: {
    label: 'Photo redesign',
    hint: 'The upload-a-photo "Try it now" + "old photos" sections and /api/generate.',
    fields: {
      enabled: { type: 'bool', label: 'Section enabled' },
      model: { type: 'enum', values: MODELS, label: 'OpenAI image model' },
      quality: { type: 'enum', values: QUALITIES, label: 'Image quality' },
      size: { type: 'enum', values: API_SIZES, label: 'Output size (occasions)' },
      inputFidelity: { type: 'enum', values: FIDELITY, label: 'Input fidelity (face preservation)' },
      rateLimitMax: { type: 'int', min: 1, max: 100, label: 'Rate limit — requests / 15 min per IP' },
    },
  },
  postcard: {
    label: 'Postcards',
    hint: 'The "Generate a personalized postcard" section, /api/postcard-generate, and the ready-made gallery.',
    fields: {
      enabled: { type: 'bool', label: 'Generator section enabled' },
      model: { type: 'enum', values: MODELS, label: 'OpenAI image model' },
      quality: { type: 'enum', values: QUALITIES, label: 'Image quality' },
      rateLimitMax: { type: 'int', min: 1, max: 100, label: 'Rate limit — requests / 15 min per IP' },
      perPage: { type: 'int', min: 4, max: 100, label: 'Ready-made gallery — designs per page' },
      sizes: {
        type: 'sizes',
        apiValues: API_SIZES,
        label: 'Selectable formats & prices (¢ — 0 uses the flat postcard price)',
      },
    },
  },
  orders: {
    label: 'Pricing & shipping',
    hint: 'Applies to every printed order — postcards and photo prints alike.',
    fields: {
      postcardPriceCents: {
        type: 'int',
        min: 0,
        max: 100000,
        label: 'Price per printed postcard (USD cents, e.g. 499 = $4.99)',
      },
      originZip: { type: 'zip', label: 'Mail-from ZIP (for USPS delivery estimate)' },
    },
  },
  photoprint: {
    label: 'Print your photos',
    hint: 'The "Print your photos and mail them" section. Each format has its own price in the cart.',
    fields: {
      enabled: { type: 'bool', label: 'Section enabled' },
      formats10: {
        type: 'priceformats',
        label: 'Formats — fit in a #10 envelope (folded/flat, no extra postage)',
      },
      formatsCatalog: {
        type: 'priceformats',
        label: 'Formats — need a catalog envelope (larger, mailed flat)',
      },
    },
  },
}

// --- validators -------------------------------------------------------

const boolv = (v) => (typeof v === 'boolean' ? v : undefined)
const enumv = (v, values) => (values.includes(v) ? v : undefined)
const intv = (v, min, max) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined
}
// like intv but keeps up to 2 decimals (print sizes like 2.5 × 3.5)
const dimv = (v, min, max) => {
  const n = Math.round(Number(v) * 100) / 100
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined
}
const slug = (v) => (typeof v === 'string' && /^[a-z0-9-]{1,20}$/.test(v.trim()) ? v.trim() : null)
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function validSizes(arr) {
  if (!Array.isArray(arr) || !arr.length || arr.length > 12) return null
  const out = []
  const seen = new Set()
  for (const it of arr) {
    const id = slug(it?.id)
    const label = str(it?.label, 40)
    const api = enumv(it?.api, API_SIZES)
    if (!id || !label || !api || seen.has(id)) return null
    // priceCents is optional (older saved lists won't have it); 0 = fall
    // back to the flat postcard price.
    const priceCents = it?.priceCents == null ? 0 : intv(it.priceCents, 0, 100000)
    if (priceCents === undefined) return null
    seen.add(id)
    out.push({ id, label, api, priceCents })
  }
  return out
}

export function validPriceFormats(arr) {
  if (!Array.isArray(arr) || !arr.length || arr.length > 12) return null
  const out = []
  const seen = new Set()
  for (const it of arr) {
    const id = slug(it?.id)
    const label = str(it?.label, 40)
    const w = dimv(it?.w, 0.5, 48)
    const h = dimv(it?.h, 0.5, 48)
    const priceCents = intv(it?.priceCents, 0, 100000)
    if (!id || !label || w === undefined || h === undefined || priceCents === undefined || seen.has(id))
      return null
    seen.add(id)
    out.push({ id, label, w, h, priceCents })
  }
  return out
}

function validateField(rule, v) {
  if (rule.type === 'bool') return boolv(v)
  if (rule.type === 'enum') return enumv(v, rule.values)
  if (rule.type === 'int') return intv(v, rule.min, rule.max)
  if (rule.type === 'sizes') return validSizes(v) || undefined
  if (rule.type === 'priceformats') return validPriceFormats(v) || undefined
  if (rule.type === 'zip') {
    const z = String(v ?? '').trim()
    return z === '' || /^\d{5}$/.test(z) ? z : undefined
  }
  return undefined
}

// Coerce + validate an incoming partial config. Unknown keys / groups and
// bad values are dropped; only valid values survive.
export function pickValid(input = {}) {
  const out = {}
  for (const [group, { fields }] of Object.entries(CONFIG_SCHEMA)) {
    const src = input[group]
    if (!src || typeof src !== 'object') continue
    const g = {}
    for (const [key, rule] of Object.entries(fields)) {
      if (!(key in src)) continue
      const val = validateField(rule, src[key])
      if (val !== undefined) g[key] = val
    }
    if (Object.keys(g).length) out[group] = g
  }
  return out
}

// --- load + migrate -------------------------------------------------

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null)

// Map a stored doc (any generation of the schema) onto the current shape.
function migrate(s = {}) {
  const legacy = boolv(s.generateEnabled) // the original single toggle
  const p = s.photo || {}
  const pc = s.postcard || {}

  return {
    photo: {
      enabled: pick(boolv(p.enabled), boolv(s.photoRedesignEnabled), legacy, DEFAULTS.photo.enabled),
      model: pick(enumv(p.model, MODELS), enumv(s.imageModel, MODELS), DEFAULTS.photo.model),
      quality: pick(enumv(p.quality, QUALITIES), enumv(s.imageQuality, QUALITIES), DEFAULTS.photo.quality),
      size: pick(enumv(p.size, API_SIZES), enumv(s.imageSize, API_SIZES), DEFAULTS.photo.size),
      inputFidelity: pick(
        enumv(p.inputFidelity, FIDELITY),
        enumv(s.inputFidelity, FIDELITY),
        DEFAULTS.photo.inputFidelity
      ),
      rateLimitMax: pick(intv(p.rateLimitMax, 1, 100), intv(s.rateLimitMax, 1, 100), DEFAULTS.photo.rateLimitMax),
    },
    postcard: {
      enabled: pick(
        boolv(pc.enabled),
        boolv(s.postcardDesignEnabled),
        legacy,
        DEFAULTS.postcard.enabled
      ),
      model: pick(enumv(pc.model, MODELS), enumv(s.imageModel, MODELS), DEFAULTS.postcard.model),
      quality: pick(enumv(pc.quality, QUALITIES), enumv(s.imageQuality, QUALITIES), DEFAULTS.postcard.quality),
      rateLimitMax: pick(
        intv(pc.rateLimitMax, 1, 100),
        intv(s.rateLimitMax, 1, 100),
        DEFAULTS.postcard.rateLimitMax
      ),
      perPage: pick(intv(pc.perPage, 4, 100), intv(s.postcardsPerPage, 4, 100), DEFAULTS.postcard.perPage),
      sizes: validSizes(pc.sizes) || DEFAULTS.postcard.sizes,
    },
    orders: {
      postcardPriceCents: pick(
        intv((s.orders || {}).postcardPriceCents, 0, 100000),
        intv(pc.priceCents, 0, 100000), // legacy: was under `postcard`
        DEFAULTS.orders.postcardPriceCents
      ),
      originZip: [
        String((s.orders || {}).originZip || ''),
        String(pc.originZip || ''), // legacy: was under `postcard`
      ].find((z) => /^\d{5}$/.test(z)) || DEFAULTS.orders.originZip,
    },
    photoprint: migratePhotoprint(s.photoprint || {}),
  }
}

// formats10/formatsCatalog replaced a single flat `formats` list. If only
// the old list is on record, split it by size so nothing is lost: anything
// that clears a standard #10 envelope stays there, bigger goes to catalog.
function migratePhotoprint(pp) {
  const formats10 = validPriceFormats(pp.formats10)
  const formatsCatalog = validPriceFormats(pp.formatsCatalog)
  if (formats10 || formatsCatalog) {
    return {
      enabled: pick(boolv(pp.enabled), DEFAULTS.photoprint.enabled),
      formats10: formats10 || DEFAULTS.photoprint.formats10,
      formatsCatalog: formatsCatalog || DEFAULTS.photoprint.formatsCatalog,
    }
  }
  const legacyAll = validPriceFormats(pp.formats)
  if (legacyAll) {
    return {
      enabled: pick(boolv(pp.enabled), DEFAULTS.photoprint.enabled),
      formats10: legacyAll.filter((f) => f.w * f.h <= 24),
      formatsCatalog: legacyAll.filter((f) => f.w * f.h > 24),
    }
  }
  return {
    enabled: pick(boolv(pp.enabled), DEFAULTS.photoprint.enabled),
    formats10: DEFAULTS.photoprint.formats10,
    formatsCatalog: DEFAULTS.photoprint.formatsCatalog,
  }
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
  cache = migrate(stored)
  cacheAt = Date.now()
  return cache
}

export function invalidateConfigCache() {
  cache = null
}

export { DEFAULTS as CONFIG_DEFAULTS }
