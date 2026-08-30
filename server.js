import express from 'express'
import compression from 'compression'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import OpenAI, { toFile } from 'openai'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8080

// gpt-image-1-mini keeps per-image cost around a cent while we're in the
// waitlist/testing phase. Swap OPENAI_IMAGE_MODEL to gpt-image-2 for launch
// — same endpoint, same params.
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini'
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium'
const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1536' // portrait postcard

// Restoring an old photo should keep its own framing, so let the model match
// the input aspect ratio instead of forcing the portrait postcard size.
const CATEGORY_SIZE = {
  modernize: 'auto',
  restore: 'auto',
}

// Prompt templates per category. Users never send a free-form prompt — that
// keeps cost, tone, and content predictable.
const CATEGORY_PROMPTS = {
  love:
    'Redesign this photo as a romantic postcard. Keep the people and their faces recognizable and unchanged. Replace the background with a warm, dreamy scene with soft golden light, delicate florals, and gentle bokeh. Elegant, heartfelt, print-ready.',
  family:
    'Redesign this photo as a warm family keepsake print. Keep every person and their face recognizable and unchanged. Give it a cozy, timeless setting with soft natural light and a tasteful painterly background. Wholesome and frame-worthy.',
  birthday:
    'Redesign this photo as a cheerful birthday card. Keep the people and their faces recognizable and unchanged. Add a festive background with confetti, balloons, and bright celebratory colors. Fun, joyful, print-ready.',
  christmas:
    'Redesign this photo as a Christmas holiday card. Keep every person and their face recognizable and unchanged. Replace the background with a cozy festive scene — snow, warm string lights, pine, and a soft winter palette. Classic and heartwarming.',
  modernize:
    'Fully restore and modernize this damaged old photograph. Reconstruct any missing, torn-away, or destroyed areas — fill them in seamlessly so they match the surrounding content, lighting, and texture with no visible seams or gaps. Add natural, realistic color throughout if the original is black and white or sepia (lifelike skin tones, hair, clothing, and background). Remove blur and soft focus: recover sharp, clean, natural facial features — eyes, mouth, hair, and skin should read clearly and look like a real person, staying faithful to the original face. Remove scratches, creases, stains, dust, grain, and fading, and correct exposure and contrast. Keep every person\'s identity, likeness, pose, expression, clothing, and the original framing and composition true to the source — do not invent new people or change who anyone is. Deliver a clean, sharp, high-quality result that looks like a well-preserved modern photograph.',
  restore:
    'Carefully restore this old photograph to the condition it was in when new. Repair physical damage — scratches, tears, creases, stains, spots — and reconstruct missing or torn-away areas so they blend in seamlessly with the surrounding content. Reduce dust, grain, and fading, and gently recover sharpness where the image is soft, keeping facial features clean and natural. Preserve the original character: keep the black-and-white, sepia, or faded-color tone and the period look — do not colorize a black-and-white photo. Do not alter faces, expressions, clothing, or composition.',
}

const app = express()
app.use(compression())

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Unsupported image type — use PNG, JPEG, or WebP.'), ok)
  },
})

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 generations per IP per 15 min while we're testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in a few minutes.' },
})

app.post('/api/generate', generateLimiter, (req, res) => {
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

    try {
      const image = await toFile(req.file.buffer, req.file.originalname || 'photo.png', {
        type: req.file.mimetype,
      })
      const result = await openai.images.edit({
        model: IMAGE_MODEL,
        image,
        prompt,
        size: CATEGORY_SIZE[category] || IMAGE_SIZE,
        quality: IMAGE_QUALITY,
      })

      const b64 = result.data?.[0]?.b64_json
      if (!b64) {
        return res.status(502).json({ error: 'The model returned no image. Try again.' })
      }

      console.log(
        `[generate] category=${category} model=${IMAGE_MODEL} quality=${IMAGE_QUALITY} ` +
          `bytes_in=${req.file.size} usage=${JSON.stringify(result.usage || {})}`
      )

      res.json({ image: `data:image/png;base64,${b64}` })
    } catch (err) {
      console.error('[generate] failed:', err?.message || err)
      const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500
      res.status(status).json({ error: 'Could not redesign the photo right now. Try again.' })
    }
  })
})

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
