// AI photo calendar: the customer uploads a few photos and gives a short
// scene reference ("a field of wildflowers", "a galaxy", "a children's
// park"). We build a controlled prompt for a creative 8×10 in, twelve-month
// wall calendar. Like the postcard generator, the customer's text is
// sanitised and length-capped — nothing free-form reaches the model raw.

const SCENE_MAX = 120

// Keep letters (incl. accents), digits, spaces and mild punctuation. Drop
// anything that could steer the model.
function cleanScene(v) {
  return String(v == null ? '' : v)
    .replace(/[<>{}[\]|`"\\]/g, ' ')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCENE_MAX)
}

export function validateCalendar(input = {}, cfg = {}) {
  const errors = []

  const scene = cleanScene(input.scene)
  const photoCount = Math.max(0, Math.min(4, Math.trunc(Number(input.photoCount) || 0)))
  if (!photoCount) errors.push('Add at least one photo.')

  const year = Number.isFinite(cfg.year) ? cfg.year : 2027

  return {
    errors,
    value: errors.length ? null : { year, scene, photoCount },
  }
}

export function buildCalendarPrompt({ year, scene, photoCount }) {
  const setting = scene
    ? `Set the whole design in this world: ${scene}. Build the colour palette, textures and decorative motifs from that scene.`
    : `Choose one cohesive, imaginative themed world (nature, cosmic, seasonal or whimsical) and build the whole design around it.`

  const photos =
    photoCount === 1
      ? `Integrate the one provided photograph into the artwork as a tastefully framed inset — a decorative photo frame, polaroid, or vignette that sits naturally within the scene, with a soft shadow and matching border, not pasted flat on top.`
      : `Integrate the ${photoCount} provided photographs into the artwork as tastefully framed insets — decorative photo frames, polaroids or vignettes of varied sizes arranged around the layout, each with a soft shadow and a border that matches the scene, blended into the design rather than pasted flat on top. Keep the photos themselves photorealistic and unaltered.`

  return [
    `A creative, print-ready 8 by 10 inch PORTRAIT wall-calendar poster for the year ${year}.`,
    setting,
    `Show all twelve months of ${year} — January through December — as twelve month blocks arranged in a neat, balanced grid.`,
    `Each month's NAME is large, decorative and clearly readable. Under it, a real calendar grid with weekday column headers and the correct date numbers, all crisp, high-contrast and easily legible even at small size.`,
    photos,
    `Add a few short, warm, creative touches of hand-lettered text that fit the theme, but keep the month names, weekdays and dates the clear focus.`,
    `CRITICAL: the entire composition — every month block, all photos, all text and the border — must sit fully inside the 8×10 canvas with generous safe margins on all sides. Nothing may be cropped, cut off or run past the edges.`,
    `No watermark, no signature, no rogue gibberish text.`,
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
