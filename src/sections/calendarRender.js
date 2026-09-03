// Photo-calendar compositor. A "template" is just a background image the
// admin uploads; WE draw the twelve-month grid + year on top by code, so
// the dates are always right and nothing is clipped. The customer stacks
// framed photos + one caption on top of that.
//
// The DOM editor and this canvas exporter must agree — frame geometry
// here matches the CSS in App.css (.cme__photo--*), and the grid preview
// in the editor is produced by renderGridDataUrl() below.

export const FRAMES = [
  { id: 'white', label: 'White mat' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'thin', label: 'Thin line' },
  { id: 'double', label: 'Double mat' },
  { id: 'shadowbox', label: 'Shadow box' },
  { id: 'none', label: 'None' },
]

export const FONTS = [
  { id: 'Playfair Display', label: 'Playfair' },
  { id: 'Cormorant Garamond', label: 'Cormorant' },
  { id: 'Marcellus', label: 'Marcellus' },
  { id: 'Prata', label: 'Prata' },
  { id: 'Cinzel', label: 'Cinzel' },
  { id: 'Great Vibes', label: 'Great Vibes' },
  { id: 'Parisienne', label: 'Parisienne' },
]

export const LAYOUTS = [
  { id: 'bottom', label: 'Bottom half' },
  { id: 'side', label: 'Side strip' },
]

export const PANELS = [
  { id: 'light', label: 'Light panel' },
  { id: 'dark', label: 'Dark panel' },
  { id: 'none', label: 'No panel' },
]

export const DEFAULT_LAYOUT = {
  position: 'bottom',
  ink: '#2b2b2e',
  accent: '#b8355f',
  titleFont: 'Cinzel',
  panel: 'light',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function monthCells(year, m) {
  const first = new Date(year, m, 1).getDay()
  const days = new Date(year, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = i - first + 1
    cells.push(d >= 1 && d <= days ? d : null)
  }
  while (cells.length > 35 && cells.slice(-7).every((c) => c === null)) cells.length -= 7
  return cells
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawMonth(ctx, box, year, m, o) {
  const cells = monthCells(year, m)
  const gridRows = cells.length / 7
  const nameH = box.h * 0.17
  const headH = box.h * 0.1
  const rowH = (box.h - nameH - headH) / gridRows
  const colW = box.w / 7

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = o.accent
  ctx.font = `600 ${nameH * 0.58}px "${o.titleFont}", serif`
  ctx.fillText(MONTHS[m].toUpperCase(), box.x + box.w / 2, box.y + nameH * 0.5)

  ctx.font = `700 ${headH * 0.62}px Inter, Arial, sans-serif`
  ctx.fillStyle = o.ink
  for (let i = 0; i < 7; i++) {
    ctx.globalAlpha = 0.5
    ctx.fillText(WD[i], box.x + colW * (i + 0.5), box.y + nameH + headH * 0.5)
  }
  ctx.globalAlpha = 1

  ctx.font = `500 ${rowH * 0.52}px Inter, Arial, sans-serif`
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] == null) continue
    const cc = i % 7
    const rr = Math.floor(i / 7)
    ctx.fillText(String(cells[i]), box.x + colW * (cc + 0.5), box.y + nameH + headH + rowH * (rr + 0.5))
  }
  ctx.restore()
}

export function drawCalendarGrid(ctx, { year, W, H, layout }) {
  const L = { ...DEFAULT_LAYOUT, ...(layout || {}) }
  let area
  let cols
  let rows
  let yearRect

  if (L.position === 'side') {
    area = { x: 0.55 * W, y: 0.15 * H, w: 0.4 * W, h: 0.8 * H }
    cols = 2
    rows = 6
    yearRect = { x: 0.55 * W, y: 0.05 * H, w: 0.4 * W, h: 0.08 * H }
  } else {
    area = { x: 0.06 * W, y: 0.5 * H, w: 0.88 * W, h: 0.44 * H }
    cols = 3
    rows = 4
    yearRect = { x: 0.06 * W, y: 0.4 * H, w: 0.88 * W, h: 0.08 * H }
  }

  if (L.panel !== 'none') {
    const pad = Math.min(W, H) * 0.03
    const px = Math.min(area.x, yearRect.x) - pad
    const py = Math.min(area.y, yearRect.y) - pad
    const pw = Math.max(area.x + area.w, yearRect.x + yearRect.w) - px + pad
    const ph = area.y + area.h - py + pad
    ctx.save()
    ctx.fillStyle = L.panel === 'dark' ? 'rgba(18,10,14,0.6)' : 'rgba(255,255,255,0.84)'
    roundRect(ctx, px, py, pw, ph, Math.min(W, H) * 0.02)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = L.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${yearRect.h * 0.95}px "${L.titleFont}", serif`
  ctx.fillText(String(year), yearRect.x + yearRect.w / 2, yearRect.y + yearRect.h / 2)
  ctx.restore()

  const gap = area.w * 0.022
  const cw = (area.w - gap * (cols - 1)) / cols
  const chh = (area.h - gap * (rows - 1)) / rows
  for (let m = 0; m < 12; m++) {
    const c = m % cols
    const r = Math.floor(m / cols)
    drawMonth(
      ctx,
      { x: area.x + c * (cw + gap), y: area.y + r * (chh + gap), w: cw, h: chh },
      year,
      m,
      L
    )
  }
}

// A PNG data URL of just the grid, for the live editor preview.
export function renderGridDataUrl(w, h, year, layout) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w)
  canvas.height = Math.round(h)
  drawCalendarGrid(canvas.getContext('2d'), { year, W: canvas.width, H: canvas.height, layout })
  return canvas.toDataURL('image/png')
}

// --- photo frames --------------------------------------------------

function drawCover(ctx, img, ix, iy, iw, ih) {
  const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.save()
  ctx.beginPath()
  ctx.rect(ix, iy, iw, ih)
  ctx.clip()
  ctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh)
  ctx.restore()
}

function drawFrame(ctx, frame, img, w, h) {
  const x = -w / 2
  const y = -h / 2
  const s = Math.min(w, h)

  if (frame === 'none') {
    drawCover(ctx, img, x, y, w, h)
    return
  }
  if (frame === 'thin') {
    drawCover(ctx, img, x, y, w, h)
    ctx.strokeStyle = '#2b2b2e'
    ctx.lineWidth = Math.max(2, s * 0.014)
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
    return
  }

  const pad = frame === 'shadowbox' ? s * 0.04 : s * 0.06
  const padBottom = frame === 'polaroid' ? s * 0.2 : pad

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = frame === 'shadowbox' ? s * 0.1 : s * 0.06
  ctx.shadowOffsetY = frame === 'shadowbox' ? s * 0.05 : s * 0.03
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  const ix = x + pad
  const iy = y + pad
  const iw = w - pad * 2
  const ih = h - pad - padBottom
  drawCover(ctx, img, ix, iy, iw, ih)

  if (frame === 'double') {
    ctx.strokeStyle = 'rgba(43,43,46,0.55)'
    ctx.lineWidth = Math.max(1, s * 0.006)
    const g = pad * 0.4
    ctx.strokeRect(ix - g, iy - g, iw + g * 2, ih + g * 2)
  }
}

function drawText(ctx, layer, W, H) {
  const px = layer.size * H
  const weight = layer.font === 'Cinzel' || layer.font === 'Playfair Display' ? '600' : '500'
  ctx.font = `${weight} ${px}px "${layer.font}", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = String(layer.text || '').split('\n')
  const lh = px * 1.18
  const top = -((lines.length - 1) * lh) / 2

  lines.forEach((line, i) => {
    const y = top + i * lh
    if (layer.shadow) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = px * 0.12
      ctx.shadowOffsetY = px * 0.06
      ctx.fillStyle = layer.color
      ctx.fillText(line, 0, y)
      ctx.restore()
    }
    if (layer.outline) {
      ctx.lineWidth = Math.max(1, px * 0.06)
      ctx.strokeStyle = layer.color === '#ffffff' ? 'rgba(0,0,0,0.65)' : '#ffffff'
      ctx.lineJoin = 'round'
      ctx.strokeText(line, 0, y)
    }
    ctx.fillStyle = layer.color
    ctx.fillText(line, 0, y)
  })
}

async function ensureFonts(layers, layout) {
  const fams = new Set(['Inter'])
  layers.filter((l) => l.kind === 'text').forEach((l) => fams.add(l.font))
  if (layout?.titleFont) fams.add(layout.titleFont)
  try {
    await Promise.all([...fams].map((f) => document.fonts.load(`600 64px "${f}"`)))
    await document.fonts.ready
  } catch {
    /* fall back to serif / sans */
  }
}

// templateImg: loaded HTMLImageElement. layers: normalized (0..1) coords.
export async function renderCalendar(templateImg, layers, photoImgs, { year, layout }) {
  await ensureFonts(layers, layout)
  const W = templateImg.naturalWidth || 2400
  const H = templateImg.naturalHeight || 3000
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(templateImg, 0, 0, W, H)

  for (const layer of [...layers].sort((a, b) => a.z - b.z)) {
    ctx.save()
    ctx.translate((layer.x + layer.w / 2) * W, (layer.y + layer.h / 2) * H)
    ctx.rotate(((layer.rot || 0) * Math.PI) / 180)
    if (layer.kind === 'photo') {
      const img = photoImgs[layer.id]
      if (img) drawFrame(ctx, layer.frame, img, layer.w * W, layer.h * H)
    } else {
      drawText(ctx, layer, W, H)
    }
    ctx.restore()
  }

  // the calendar grid always sits on top, so it can never be covered
  drawCalendarGrid(ctx, { year, W, H, layout })

  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Could not render the calendar.'))),
      'image/jpeg',
      0.92
    )
  )
}
