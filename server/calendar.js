// AI photo calendar: the customer uploads a few photos, picks a background
// colour, and we build a controlled prompt for an 8×10 in, twelve-month
// wall calendar. Like the postcard generator, no free-form text from the
// customer reaches the model — only a colour and a photo count.

const NAMED = {
  cream: '#fff6e9',
  blush: '#fbe6ec',
  sage: '#dce7da',
  sky: '#dce9f5',
  lavender: '#e7e0f2',
  terracotta: '#e7b7a3',
  gold: '#e9d9a8',
  charcoal: '#2b2b2e',
  navy: '#1e2a44',
  white: '#ffffff',
}

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || '').trim())

export function validateCalendar(input = {}, cfg = {}) {
  const errors = []

  let bg = String(input.bg || '').trim().toLowerCase()
  if (NAMED[bg]) bg = NAMED[bg]
  if (!isHex(bg)) {
    errors.push('Pick a background colour.')
    bg = null
  }

  const photoCount = Math.max(0, Math.min(4, Math.trunc(Number(input.photoCount) || 0)))
  if (!photoCount) errors.push('Add at least one photo.')

  const year = Number.isFinite(cfg.year) ? cfg.year : 2027

  return {
    errors,
    value: errors.length ? null : { year, bg, photoCount },
  }
}

export function buildCalendarPrompt({ year, bg, photoCount }) {
  const imagery =
    photoCount === 1
      ? 'Feature the provided photograph prominently as the large header image across the top.'
      : `Arrange the ${photoCount} provided photographs as a tasteful decorative band or collage across the top and sides, all kept photorealistic and unaltered.`

  return [
    `A polished, print-ready 8 by 10 inch portrait wall calendar poster for the year ${year}.`,
    `Show all twelve months of ${year} — January through December — as twelve clean, evenly spaced mini month grids arranged in a tidy layout,`,
    `each grid labelled with its month name and "${year}", with weekday column headers and correctly aligned date numbers.`,
    imagery,
    `Solid background colour exactly ${bg}.`,
    `Elegant modern typography, strong contrast against the background, generous safe margins so nothing is cut off at the edges.`,
    `No watermark, no signature, no caption text other than the month names, dates and the year.`,
  ].join(' ')
}

// `images` is an array of toFile() results (may be empty → plain generate).
export async function generateCalendar(openai, calendarCfg, value, images = []) {
  const base = {
    model: calendarCfg.model,
    prompt: buildCalendarPrompt(value),
    size: '1024x1536', // portrait, ~8×10 ratio
    quality: calendarCfg.quality,
  }
  const result = images.length
    ? await openai.images.edit({ ...base, image: images })
    : await openai.images.generate(base)

  return { b64: result.data?.[0]?.b64_json, usage: result.usage || {} }
}
