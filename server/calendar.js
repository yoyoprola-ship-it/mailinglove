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
    ? `Theme the whole design around this world: ${scene}. Draw the colour palette, textures and decorative motifs from that scene.`
    : `Choose one cohesive, imaginative themed world (nature, cosmic, seasonal or whimsical) and build the whole design around it.`

  const one = photoCount === 1
  const n = one ? 'the one' : `all ${photoCount}`

  return [
    `A creative, print-ready PORTRAIT wall-calendar poster (tall 2:3 canvas) for the year ${year}.`,

    // --- hard constraint 1: nothing outside the canvas ---
    `ABSOLUTE RULE — KEEP EVERYTHING INSIDE THE FRAME: leave a clear empty margin of at least 8% on every side of the poster. No date number, weekday letter, month name, grid line, photo, frame, decoration or border may touch, overlap or extend past any edge of the poster. Every one of the twelve month grids must show its complete 6-row date grid fully within the poster. If space runs short, shrink the month grids and the artwork — never let anything spill outside the canvas or off the bottom of a month.`,

    // --- hard constraint 2: photos untouched ---
    `ABSOLUTE RULE — DO NOT ALTER THE SUPPLIED PHOTOS: reproduce ${n} provided photograph(s) in full, every edge visible, nothing cut off, not re-framed, not zoomed, not cropped, not stretched, not recoloured, not covered — each stays exactly as supplied and fully photorealistic. Each photo is a small element: it occupies at most a quarter of the poster width, sits well inside the margins, and has a visible gap between the photo and its frame. Give each photo a decorative frame (ornate frame, polaroid, taped snapshot or vignette with a soft shadow, styled from the scene) and place the framed photos at varied sizes and slight angles, woven into the artwork, never pasted flat on top and never bleeding off an edge.`,

    setting,

    // --- the calendar content ---
    `Lay out all twelve months of ${year} — January through December — as twelve tidy month blocks in a balanced grid with equal gutters.`,
    `Each block: the MONTH NAME large, decorative and clearly readable at the top; below it a real calendar grid with a row of weekday column headers (Sun–Sat) and the correct date numbers for ${year}, every number crisp, high-contrast and legible, none touching its neighbours or the block edge.`,
    `A few short warm hand-lettered touches that fit the theme are welcome, but the month names, weekdays and dates stay the clear focus and must remain fully readable.`,

    `No watermark, no signature, no gibberish text.`,
  ].join(' ')
}

// `images` is an array of toFile() results (may be empty → plain generate).
export async function generateCalendar(openai, calendarCfg, value, images = []) {
  const base = {
    model: calendarCfg.model,
    prompt: buildCalendarPrompt(value),
    size: '1024x1536', // tallest portrait the API offers
    quality: calendarCfg.quality,
  }
  const result = images.length
    ? await openai.images.edit({ ...base, image: images })
    : await openai.images.generate(base)

  return { b64: result.data?.[0]?.b64_json, usage: result.usage || {} }
}
