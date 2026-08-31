import { catalog } from './catalog.js'

// Text-to-image ("ChatGPT generates it") custom postcard. The user supplies a
// name + category (+ optional recipient subcategory, message, background); we
// assemble a controlled prompt and call images.generate — no user free-form
// prompt reaches the model verbatim, everything is sanitized and length-capped.

// gpt-image only supports these output ratios. All three fit a #10 envelope.
export const POSTCARD_SIZES = {
  '4x6': { label: '4×6 in — vertical', api: '1024x1536' },
  '6x4': { label: '6×4 in — horizontal', api: '1536x1024' },
  '4x4': { label: '4×4 in — square', api: '1024x1024' },
}

const LIMITS = { name: 60, message: 250, background: 160 }

// Keep letters (incl. accents), digits, spaces and mild punctuation. Drop
// anything that could steer the model (braces, brackets, backticks, quotes,
// angle brackets, pipes, newlines).
function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[<>{}\[\]|`"\\]/g, ' ')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const typeById = new Map(catalog.types.map((t) => [t.id, t]))

export function validateCustomPostcard(input = {}) {
  const errors = []
  const name = clean(input.name, LIMITS.name)
  const message = clean(input.message, LIMITS.message)
  const background = clean(input.background, LIMITS.background)

  const type = typeById.get(String(input.category || ''))
  const sizeKey = String(input.size || '')
  const size = POSTCARD_SIZES[sizeKey]

  let sub = null
  if (type && input.subcategory) {
    sub = type.subcategories.find((s) => s.id === input.subcategory) || null
    if (!sub) errors.push('Pick a valid recipient.')
  }

  if (!name) errors.push('Enter the name for the postcard.')
  if (!type) errors.push('Pick a category.')
  if (!size) errors.push('Pick a size.')

  return {
    errors,
    value: errors.length
      ? null
      : { name, typeLabel: type.label, subLabel: sub?.label || null, message, background, sizeApi: size.api },
  }
}

export function buildPostcardPrompt({ name, typeLabel, subLabel, message, background }) {
  const occ = typeLabel.toLowerCase()
  let p = `A polished, print-ready ${occ} greeting postcard`
  if (subLabel) p += ` for a ${subLabel.toLowerCase()}`
  p += `. Feature the name ${name} as the personalized focal point, in elegant, clearly legible hand-lettered typography.`
  p += message
    ? ` Include this greeting, spelled exactly and easy to read: ${message}.`
    : ` Include a short, warm ${occ} greeting in tasteful typography.`
  p += background
    ? ` Background and art style: ${background}.`
    : ` Use a tasteful themed background that suits the occasion.`
  p +=
    ' Balanced composition, generous safe margins so nothing important is near the edges, no photo of a real person, no watermark, no signature, no extra text.'
  return p
}

export async function generateCustomPostcard(openai, cfg, value) {
  const params = {
    model: cfg.imageModel,
    prompt: buildPostcardPrompt(value),
    size: value.sizeApi,
    quality: cfg.imageQuality,
    output_format: 'jpeg', // ~200-500 KB instead of a 3-4 MB PNG
    output_compression: 82,
  }
  let result
  try {
    result = await openai.images.generate(params)
  } catch (err) {
    if (/output_format|output_compression/i.test(err?.message || '')) {
      delete params.output_format
      delete params.output_compression
      result = await openai.images.generate(params)
    } else throw err
  }
  const b64 = result.data?.[0]?.b64_json
  return { b64, usage: result.usage || {} }
}
