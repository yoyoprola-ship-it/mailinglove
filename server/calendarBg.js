// AI makes ONLY the 8×10 background for a photo calendar — no calendar
// grid, no text, no photos. Those are added deterministically afterwards
// (the site draws the twelve-month grid; the customer drops framed photos
// and one caption). The customer's scene text is sanitised and capped.

const SCENE_MAX = 120

function cleanScene(v) {
  return String(v == null ? '' : v)
    .replace(/[<>{}[\]|`"\\]/g, ' ')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCENE_MAX)
}

export function validateScene(input = {}) {
  const scene = cleanScene(input.scene)
  return { errors: scene ? [] : ['Describe the background you want.'], value: { scene } }
}

export function buildBgPrompt({ scene }) {
  return [
    `A beautiful, print-ready 8 by 10 inch PORTRAIT background image: ${scene}.`,
    `Soft, cohesive and uncluttered, with calm negative space and gentle edges so text and photos can be laid on top later.`,
    `Even, pleasing composition; no strong focal clutter in the corners.`,
    `Absolutely NO text, NO numbers, NO calendar or grid, NO photo frames, NO borders, NO people's faces — just the atmospheric backdrop.`,
  ].join(' ')
}

export async function generateBackground(openai, calendarCfg, value) {
  const result = await openai.images.generate({
    model: calendarCfg.model,
    prompt: buildBgPrompt(value),
    size: '1024x1536',
    quality: calendarCfg.quality,
  })
  return { b64: result.data?.[0]?.b64_json, usage: result.usage || {} }
}
