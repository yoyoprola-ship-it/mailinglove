import express from 'express'
import compression from 'compression'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import OpenAI, { toFile } from 'openai'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getConfig, invalidateConfigCache, pickValid, CONFIG_SCHEMA, CONFIG_DEFAULTS } from './server/config.js'
import { getDb } from './server/firebaseAdmin.js'
import { recordVisit, getStats } from './server/analytics.js'
import {
  adminConfigured,
  adminSetupIssues,
  startChallenge,
  verifyChallenge,
  requireAdmin,
  sessionCookie,
  clearCookie,
} from './server/adminAuth.js'
import {
  userAuthConfigured,
  startUserChallenge,
  verifyUserChallenge,
  requireUser,
  getUser,
  saveProfile,
  userSessionCookie,
  clearUserCookie,
} from './server/userAuth.js'
import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  decItem,
  placeOrder,
  listOrders,
  listAllOrders,
  setOrderStatus,
} from './server/cart.js'
import {
  validateCustomPostcard,
  generateCustomPostcard,
} from './server/customPostcard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8080
const RATE_WINDOW_MS = (Number(process.env.RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000

// Restoring an old photo should keep its own framing, so let the model match
// the input aspect ratio instead of forcing the portrait postcard size.
const CATEGORY_SIZE = {
  modernize: 'auto',
  restore: 'auto',
}

// Prompt templates per category. Users never send a free-form prompt — that
// keeps cost, tone, and content predictable.

// Every "occasion" edit must leave the people untouched and only restyle the
// scene around them. This clause leads each of those prompts.
const KEEP_PEOPLE =
  'Do NOT change any person in this photo. Every face and body must stay identical to the input: same facial features, face shape, jawline, eyes, eyebrows, nose, lips, teeth, skin tone and texture, freckles, moles, wrinkles, facial hair, hairline and hairstyle, apparent age, body shape, posture, and pose. Do not slim, smooth, retouch, beautify, restyle, age, or de-age anyone. The people must be pixel-faithful to the original — treat them as fixed and uneditable. Only the background and the surrounding scene may change.'

const CATEGORY_PROMPTS = {
  love: `${KEEP_PEOPLE} Replace only the background with a warm, dreamy romantic setting: soft golden light, delicate florals, gentle bokeh. Keep every person exactly where and how they are in the frame. Elegant, heartfelt, print-ready postcard.`,
  family: `${KEEP_PEOPLE} Replace only the background with a cozy, timeless setting with soft natural light and a tasteful, subtly painterly backdrop. Keep every person exactly where and how they are in the frame. Wholesome, frame-worthy family keepsake.`,
  birthday: `${KEEP_PEOPLE} Replace only the background with a festive birthday scene: confetti, balloons, and bright celebratory colors. Keep every person exactly where and how they are in the frame. Fun, joyful, print-ready card.`,
  christmas: `${KEEP_PEOPLE} Replace only the background with a cozy festive Christmas scene: snow, warm string lights, pine, a soft winter palette. Keep every person exactly where and how they are in the frame. Classic, heartwarming holiday card.`,
  modernize:
    'Fully restore and modernize this damaged old photograph. Reconstruct any missing, torn-away, or destroyed areas — fill them in seamlessly so they match the surrounding content, lighting, and texture with no visible seams or gaps. Add natural, realistic color throughout if the original is black and white or sepia (lifelike skin tones, hair, clothing, and background). Remove blur and soft focus: recover sharp, clean, natural facial features — eyes, mouth, hair, and skin should read clearly and look like a real person, staying faithful to the original face. Remove scratches, creases, stains, dust, grain, and fading, and correct exposure and contrast. Keep every person\'s identity, likeness, pose, expression, clothing, and the original framing and composition true to the source — do not invent new people or change who anyone is. Deliver a clean, sharp, high-quality result that looks like a well-preserved modern photograph.',
  restore:
    'Carefully restore this old photograph to the condition it was in when new. Repair physical damage — scratches, tears, creases, stains, spots — and reconstruct missing or torn-away areas so they blend in seamlessly with the surrounding content. Reduce dust, grain, and fading, and gently recover sharpness where the image is soft, keeping facial features clean and natural. Preserve the original character: keep the black-and-white, sepia, or faded-color tone and the period look — do not colorize a black-and-white photo. Do not alter faces, expressions, clothing, or composition.',
}

const app = express()
app.set('trust proxy', 1) // Firebase App Hosting terminates TLS in front of us
app.use(compression())
app.use(express.json({ limit: '256kb' }))

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

// input_fidelity isn't supported by every gpt-image model. If the configured
// model 400s on it, drop the param and retry once so a model swap can't break
// us. (Add more optional params here if we start passing them.)
const OPTIONAL_PARAMS = ['input_fidelity']

// gpt-image returns PNG; read the format from the base64 magic bytes anyway so
// this stays correct if we ever request jpeg/webp.
function imageDataUrl(b64) {
  const mime = b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('UklGR') ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${b64}`
}

async function runEdit(params) {
  try {
    return await openai.images.edit(params)
  } catch (err) {
    const msg = err?.message || ''
    const drop = OPTIONAL_PARAMS.filter((p) => p in params && new RegExp(p, 'i').test(msg))
    if (drop.length) {
      console.warn(`[generate] model rejected ${drop.join(', ')}; retrying without`)
      const rest = { ...params }
      drop.forEach((p) => delete rest[p])
      return await openai.images.edit(rest)
    }
    throw err
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Unsupported image type — use PNG, JPEG, or WebP.'), ok)
  },
})

const photoLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  limit: async () => (await getConfig()).photo.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in a few minutes.' },
})

const postcardLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  limit: async () => (await getConfig()).postcard.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in a few minutes.' },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — wait a few minutes.' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30, // customer sign-in code requests + verifies per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — wait a few minutes.' },
})

// --- public site config -------------------------------------------------

// Read-only flags the public site needs. No auth; nothing sensitive.
app.get('/api/site-config', async (req, res) => {
  const cfg = await getConfig()
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    photoRedesignEnabled: cfg.photo.enabled,
    postcardDesignEnabled: cfg.postcard.enabled,
    postcardsPerPage: cfg.postcard.perPage,
    postcardSizes: cfg.postcard.sizes.map((s) => ({ id: s.id, label: s.label })),
  })
})

// --- image redesign -------------------------------------------------------

app.post('/api/generate', photoLimiter, (req, res) => {
  upload.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message })
    }

    const category = String(req.body.category || '').toLowerCase()
    const prompt = CATEGORY_PROMPTS[category]
    if (!prompt) {
      return res.status(400).json({ error: 'Pick a valid category.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Attach a photo.' })
    }
    if (!openai) {
      return res
        .status(503)
        .json({ error: 'Image generation is not configured yet. Set OPENAI_API_KEY.' })
    }

    const { photo } = await getConfig()
    if (!photo.enabled) {
      return res.status(503).json({ error: 'Photo redesign is paused right now.' })
    }

    try {
      const image = await toFile(req.file.buffer, req.file.originalname || 'photo.png', {
        type: req.file.mimetype,
      })
      const result = await runEdit({
        model: photo.model,
        image,
        prompt,
        size: CATEGORY_SIZE[category] || photo.size,
        quality: photo.quality,
        ...(photo.inputFidelity ? { input_fidelity: photo.inputFidelity } : {}),
      })

      const b64 = result.data?.[0]?.b64_json
      if (!b64) {
        return res.status(502).json({ error: 'The model returned no image. Try again.' })
      }

      console.log(
        `[generate] category=${category} model=${photo.model} quality=${photo.quality} ` +
          `fidelity=${photo.inputFidelity || 'off'} bytes_in=${req.file.size} ` +
          `usage=${JSON.stringify(result.usage || {})}`
      )

      res.json({ image: imageDataUrl(b64) })
    } catch (err) {
      console.error('[generate] failed:', err?.message || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500
      res.status(status).json({ error: 'Could not redesign the photo right now. Try again.' })
    }
  })
})

// --- custom postcard (text-to-image) ----------------------------------

app.post('/api/postcard-generate', postcardLimiter, async (req, res) => {
  const { postcard } = await getConfig()
  const { errors, value } = validateCustomPostcard(req.body || {}, postcard.sizes)
  if (errors.length) return res.status(400).json({ error: errors[0], errors })

  if (!openai) {
    return res
      .status(503)
      .json({ error: 'Image generation is not configured yet. Set OPENAI_API_KEY.' })
  }
  if (!postcard.enabled) {
    return res.status(503).json({ error: 'Postcard generation is paused right now.' })
  }

  try {
    const { b64, usage } = await generateCustomPostcard(openai, postcard, value)
    if (!b64) return res.status(502).json({ error: 'The model returned no image. Try again.' })
    console.log(
      `[postcard-generate] type=${value.typeLabel} sub=${value.subLabel || '-'} ` +
        `size=${value.sizeApi} model=${postcard.model} quality=${postcard.quality} ` +
        `usage=${JSON.stringify(usage)}`
    )
    res.json({ image: imageDataUrl(b64) })
  } catch (err) {
    console.error('[postcard-generate] failed:', err?.message || err)
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500
    res.status(status).json({ error: 'Could not generate the postcard right now. Try again.' })
  }
})

// --- visit tracking -----------------------------------------------------

app.post('/api/track', (req, res) => {
  const { path: p, ref, visitorId } = req.body || {}
  recordVisit({
    path: typeof p === 'string' ? p : '/',
    ref: typeof ref === 'string' ? ref : '',
    visitorId: typeof visitorId === 'string' ? visitorId : '',
  })
  res.status(204).end()
})

// --- admin: auth ------------------------------------------------------

app.post('/api/admin/login/start', loginLimiter, async (req, res) => {
  if (!adminConfigured()) {
    return res.status(503).json({ error: 'Admin login is not set up yet.', missing: adminSetupIssues() })
  }
  try {
    const { challengeId, expiresInSec } = await startChallenge()
    res.json({ challengeId, expiresInSec })
  } catch (err) {
    console.error('[admin] login start failed:', err?.message || err)
    res.status(502).json({ error: 'Could not send the codes. Try again.' })
  }
})

app.post('/api/admin/login/verify', loginLimiter, async (req, res) => {
  if (!adminConfigured()) return res.status(503).json({ error: 'Admin login is not set up yet.' })
  const { challengeId, emailCode, smsCode } = req.body || {}
  try {
    const result = await verifyChallenge(challengeId, emailCode, smsCode)
    if (!result.ok) return res.status(401).json({ error: result.error, remaining: result.remaining })
    res.setHeader('Set-Cookie', sessionCookie(result.token, req.secure))
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin] login verify failed:', err?.message || err)
    res.status(500).json({ error: 'Verification failed. Try again.' })
  }
})

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearCookie(req.secure))
  res.status(204).end()
})

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ email: req.adminEmail })
})

// --- admin: config & stats -------------------------------------------

app.get('/api/admin/config', requireAdmin, async (req, res) => {
  res.json({ config: await getConfig(), schema: CONFIG_SCHEMA, defaults: CONFIG_DEFAULTS })
})

app.put('/api/admin/config', requireAdmin, async (req, res) => {
  const db = getDb()
  if (!db) return res.status(503).json({ error: 'Config store unavailable.' })
  const patch = pickValid(req.body || {})
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'No valid fields.' })
  try {
    await db.collection('config').doc('app').set(patch, { merge: true })
    invalidateConfigCache()
    console.log(`[admin] ${req.adminEmail} updated config: ${Object.keys(patch).join(', ')}`)
    res.json({ config: await getConfig() })
  } catch (err) {
    console.error('[admin] config write failed:', err?.message || err)
    res.status(500).json({ error: 'Could not save.' })
  }
})

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    res.json(await getStats())
  } catch (err) {
    console.error('[admin] stats failed:', err?.message || err)
    res.status(500).json({ error: 'Could not load stats.' })
  }
})

// --- customer accounts ---------------------------------------------

app.post('/api/auth/start', authLimiter, async (req, res) => {
  if (!userAuthConfigured()) return res.status(503).json({ error: 'Accounts are not available yet.' })
  try {
    const result = await startUserChallenge((req.body || {}).email)
    if (!result.ok) return res.status(400).json({ error: result.error })
    res.json({ challengeId: result.challengeId })
  } catch (err) {
    console.error('[auth] start failed:', err?.message || err)
    res.status(502).json({ error: 'Could not send the code. Try again.' })
  }
})

app.post('/api/auth/verify', authLimiter, async (req, res) => {
  if (!userAuthConfigured()) return res.status(503).json({ error: 'Accounts are not available yet.' })
  const { challengeId, code } = req.body || {}
  try {
    const result = await verifyUserChallenge(challengeId, code)
    if (!result.ok) return res.status(401).json({ error: result.error, remaining: result.remaining })
    res.setHeader('Set-Cookie', userSessionCookie(result.token, req.secure))
    res.json({ user: result.user })
  } catch (err) {
    console.error('[auth] verify failed:', err?.message || err)
    res.status(500).json({ error: 'Verification failed. Try again.' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearUserCookie(req.secure))
  res.status(204).end()
})

app.get('/api/me', requireUser, async (req, res) => {
  try {
    const user = await getUser(req.userEmail)
    if (!user) return res.status(404).json({ error: 'Account not found.' })
    res.json({ user })
  } catch (err) {
    console.error('[auth] me failed:', err?.message || err)
    res.status(500).json({ error: 'Could not load your account.' })
  }
})

app.put('/api/me', requireUser, async (req, res) => {
  try {
    const result = await saveProfile(req.userEmail, req.body || {})
    if (!result.ok) return res.status(400).json({ error: result.errors[0], errors: result.errors })
    res.json({ user: result.user })
  } catch (err) {
    console.error('[auth] profile save failed:', err?.message || err)
    res.status(500).json({ error: 'Could not save.' })
  }
})

// --- cart & orders (customer) --------------------------------------

const cartErr = (res, result) =>
  res.status(400).json({ error: result.errors[0], errors: result.errors })

app.get('/api/cart', requireUser, async (req, res) => {
  try {
    res.json({ items: await getCart(req.userEmail) })
  } catch (err) {
    console.error('[cart] get failed:', err?.message || err)
    res.status(500).json({ error: 'Could not load your cart.' })
  }
})

app.post('/api/cart', requireUser, async (req, res) => {
  try {
    const result = await addItem(req.userEmail, req.body || {})
    if (!result.ok) return cartErr(res, result)
    res.json({ items: result.cart, merged: Boolean(result.merged) })
  } catch (err) {
    console.error('[cart] add failed:', err?.message || err)
    res.status(500).json({ error: 'Could not add to cart.' })
  }
})

app.post('/api/cart/dec', requireUser, async (req, res) => {
  try {
    const result = await decItem(req.userEmail, String((req.body || {}).postcardId || ''))
    res.json({ items: result.cart })
  } catch (err) {
    console.error('[cart] dec failed:', err?.message || err)
    res.status(500).json({ error: 'Could not update the cart.' })
  }
})

app.put('/api/cart/:itemId', requireUser, async (req, res) => {
  try {
    const result = await updateItem(req.userEmail, req.params.itemId, req.body || {})
    if (!result.ok) return cartErr(res, result)
    res.json({ items: result.cart })
  } catch (err) {
    console.error('[cart] update failed:', err?.message || err)
    res.status(500).json({ error: 'Could not update the item.' })
  }
})

app.delete('/api/cart/:itemId', requireUser, async (req, res) => {
  try {
    const result = await removeItem(req.userEmail, req.params.itemId)
    res.json({ items: result.cart })
  } catch (err) {
    console.error('[cart] remove failed:', err?.message || err)
    res.status(500).json({ error: 'Could not remove the item.' })
  }
})

app.delete('/api/cart', requireUser, async (req, res) => {
  try {
    const result = await clearCart(req.userEmail)
    res.json({ items: result.cart })
  } catch (err) {
    console.error('[cart] clear failed:', err?.message || err)
    res.status(500).json({ error: 'Could not clear the cart.' })
  }
})

app.post('/api/orders', requireUser, async (req, res) => {
  try {
    const result = await placeOrder(req.userEmail)
    if (!result.ok) return cartErr(res, result)
    res.json({ order: result.order })
  } catch (err) {
    console.error('[orders] place failed:', err?.message || err)
    res.status(500).json({ error: 'Could not place the order.' })
  }
})

app.get('/api/orders', requireUser, async (req, res) => {
  try {
    res.json({ orders: await listOrders(req.userEmail) })
  } catch (err) {
    console.error('[orders] list failed:', err?.message || err)
    res.status(500).json({ error: 'Could not load your orders.' })
  }
})

// --- orders (admin) ----------------------------------------------

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    res.json({ orders: await listAllOrders({ status: req.query.status }) })
  } catch (err) {
    console.error('[admin] orders list failed:', err?.message || err)
    res.status(500).json({ error: 'Could not load orders.' })
  }
})

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const result = await setOrderStatus(req.params.id, (req.body || {}).status)
    if (!result.ok) return res.status(400).json({ error: result.error })
    console.log(`[admin] ${req.adminEmail} set order ${req.params.id} -> ${req.body.status}`)
    res.json({ order: result.order })
  } catch (err) {
    console.error('[admin] order update failed:', err?.message || err)
    res.status(500).json({ error: 'Could not update the order.' })
  }
})

// --- static site + SPA fallback -------------------------------------

// Hashed filenames change on every build, so they're safe to cache forever;
// index.html/the SPA fallback must never be cached, or a browser/CDN can keep
// serving an old index.html that points at an asset a later deploy deleted.
app.use(
  express.static(path.join(__dirname, 'dist'), {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'no-store')
      }
    },
  })
)
app.get(/.*/, (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
