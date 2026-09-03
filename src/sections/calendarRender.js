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
  { id: 'hearts', label: 'Hearts' },
  { id: 'floral', label: 'Floral' },
  { id: 'vine', label: 'Vine' },
  { id: 'stars', label: 'Stars' },
  { id: 'lace', label: 'Lace' },
]

export const DECOR_FRAMES = new Set(['hearts', 'floral', 'vine', 'stars', 'lace'])

export const FONTS = [
  { id: 'Playfair Display', label: 'Playfair' },
  { id: 'Cormorant Garamond', label: 'Cormorant' },
  { id: 'Marcellus', label: 'Marcellus' },
  { id: 'Prata', label: 'Prata' },
  { id: 'Cinzel', label: 'Cinzel' },
  { id: 'Great Vibes', label: 'Great Vibes' },
  { id: 'Parisienne', label: 'Parisienne' },
]

export const POSITIONS = [
  { id: 'bottom', label: 'Bottom' },
  { id: 'top', label: 'Top' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

export const PANELS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const TITLE_FONT = 'Cinzel'
const INK = { light: '#2b2b2e', dark: '#f2f2f2' }
const ACCENT = { light: '#7a2e46', dark: '#f4cfdd' }

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
  ctx.font = `600 ${nameH * 0.58}px "${TITLE_FONT}", serif`
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

// position: 'bottom' | 'top' | 'left' | 'right'; panel: 'light' | 'dark';
// panelAlpha: 0..1 opacity of the backing panel behind the dates.
export function drawCalendarGrid(
  ctx,
  { year, W, H, position = 'bottom', panel = 'light', panelAlpha }
) {
  const ink = INK[panel] || INK.light
  const accent = ACCENT[panel] || ACCENT.light
  const a = Number.isFinite(panelAlpha) ? Math.max(0, Math.min(1, panelAlpha)) : panel === 'dark' ? 0.62 : 0.86

  let area
  let cols
  let rows
  let yearRect
  if (position === 'top') {
    area = { x: 0.06 * W, y: 0.06 * H, w: 0.88 * W, h: 0.44 * H }
    cols = 3
    rows = 4
    yearRect = { x: 0.06 * W, y: 0.51 * H, w: 0.88 * W, h: 0.07 * H }
  } else if (position === 'left') {
    area = { x: 0.05 * W, y: 0.15 * H, w: 0.4 * W, h: 0.8 * H }
    cols = 2
    rows = 6
    yearRect = { x: 0.05 * W, y: 0.05 * H, w: 0.4 * W, h: 0.075 * H }
  } else if (position === 'right') {
    area = { x: 0.55 * W, y: 0.15 * H, w: 0.4 * W, h: 0.8 * H }
    cols = 2
    rows = 6
    yearRect = { x: 0.55 * W, y: 0.05 * H, w: 0.4 * W, h: 0.075 * H }
  } else {
    area = { x: 0.06 * W, y: 0.5 * H, w: 0.88 * W, h: 0.44 * H }
    cols = 3
    rows = 4
    yearRect = { x: 0.06 * W, y: 0.405 * H, w: 0.88 * W, h: 0.07 * H }
  }

  const pad = Math.min(W, H) * 0.028
  const px = Math.min(area.x, yearRect.x) - pad
  const py = Math.min(area.y, yearRect.y) - pad
  const pw = Math.max(area.x + area.w, yearRect.x + yearRect.w) - px + pad
  const ph = Math.max(area.y + area.h, yearRect.y + yearRect.h) - py + pad
  if (a > 0.001) {
    ctx.save()
    ctx.fillStyle = panel === 'dark' ? `rgba(16,9,13,${a})` : `rgba(255,255,255,${a})`
    roundRect(ctx, px, py, pw, ph, Math.min(W, H) * 0.02)
    ctx.fill()
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${yearRect.h * 0.95}px "${TITLE_FONT}", serif`
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
      { ink, accent }
    )
  }
}

// A PNG data URL of just the grid, for the live editor preview.
export function renderGridDataUrl(w, h, year, position, panel, panelAlpha) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w)
  canvas.height = Math.round(h)
  drawCalendarGrid(canvas.getContext('2d'), {
    year,
    W: canvas.width,
    H: canvas.height,
    position,
    panel,
    panelAlpha,
  })
  return canvas.toDataURL('image/png')
}

// --- photo frames --------------------------------------------------

// Fit the whole photo inside the rect (contain) — the layer box is kept at
// the photo's aspect ratio, so this never crops and never leaves a gap.
function drawFit(ctx, img, ix, iy, iw, ih) {
  const s = Math.min(iw / img.naturalWidth, ih / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh)
}

// --- decorative motifs ------------------------------------------------

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + s * 0.35)
  ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.45, cx + s * 0.55, cy - s * 1.05, cx, cy - s * 0.4)
  ctx.bezierCurveTo(cx - s * 0.55, cy - s * 1.05, cx - s * 1.05, cy - s * 0.45, cx, cy + s * 0.35)
  ctx.closePath()
}
function starPath(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r
    const a = (Math.PI / 5) * i - Math.PI / 2
    const fn = i ? 'lineTo' : 'moveTo'
    ctx[fn](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
  }
  ctx.closePath()
}
function flower(ctx, cx, cy, r, petal, mid) {
  ctx.fillStyle = petal
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    ctx.save()
    ctx.translate(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.55, r * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = mid
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2)
  ctx.fill()
}
function leaf(ctx, cx, cy, s, rot, color) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Motifs sit on the white mat, just inside the outer edge. Called with the
// box top-left at (x, y).
function drawDecor(ctx, frame, x, y, w, h) {
  const s = Math.min(w, h)
  const m = s * 0.03 // inset from the outer edge
  const corners = [
    [x + m, y + m],
    [x + w - m, y + m],
    [x + w - m, y + h - m],
    [x + m, y + h - m],
  ]
  const mids = [
    [x + w / 2, y + m],
    [x + w - m, y + h / 2],
    [x + w / 2, y + h - m],
    [x + m, y + h / 2],
  ]

  ctx.save()
  if (frame === 'hearts') {
    const r = s * 0.055
    ;[...corners, ...mids].forEach(([cx, cy], i) => {
      ctx.fillStyle = i % 2 ? '#f4b8cb' : '#e07a9c'
      heartPath(ctx, cx, cy, r)
      ctx.fill()
    })
  } else if (frame === 'stars') {
    const r = s * 0.05
    ;[...corners, ...mids].forEach(([cx, cy], i) => {
      ctx.fillStyle = i % 2 ? '#efd9a0' : '#e6c46a'
      starPath(ctx, cx, cy, r)
      ctx.fill()
    })
  } else if (frame === 'lace') {
    const dot = s * 0.022
    const step = s * 0.09
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0,0,0,0.18)'
    ctx.shadowBlur = dot * 0.8
    const ring = (px, py) => {
      ctx.beginPath()
      ctx.arc(px, py, dot, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let px = x + m; px <= x + w - m + 1; px += step) {
      ring(px, y + m)
      ring(px, y + h - m)
    }
    for (let py = y + m + step; py <= y + h - m - step + 1; py += step) {
      ring(x + m, py)
      ring(x + w - m, py)
    }
  } else if (frame === 'vine') {
    ctx.strokeStyle = '#6ba368'
    ctx.lineWidth = Math.max(1.5, s * 0.012)
    ctx.strokeRect(x + m, y + m, w - m * 2, h - m * 2)
    const step = s * 0.11
    let flip = 1
    const put = (px, py, rot) => {
      leaf(ctx, px, py, s * 0.03, rot + (flip > 0 ? 0.5 : -0.5), '#7cb87a')
      flip *= -1
    }
    for (let px = x + m + step; px < x + w - m; px += step) {
      put(px, y + m, 0)
      put(px, y + h - m, Math.PI)
    }
    for (let py = y + m + step; py < y + h - m; py += step) {
      put(x + m, py, -Math.PI / 2)
      put(x + w - m, py, Math.PI / 2)
    }
  } else if (frame === 'floral') {
    corners.forEach(([cx, cy]) => {
      const dir = [cx < x + w / 2 ? 1 : -1, cy < y + h / 2 ? 1 : -1]
      leaf(ctx, cx + dir[0] * s * 0.06, cy + dir[1] * s * 0.02, s * 0.05, 0.4 * dir[0] * dir[1], '#8fc78c')
      leaf(ctx, cx + dir[0] * s * 0.02, cy + dir[1] * s * 0.06, s * 0.045, 1.2 * dir[0] * dir[1], '#a8d6a3')
      flower(ctx, cx, cy, s * 0.06, '#f2a9bf', '#efc873')
      flower(ctx, cx + dir[0] * s * 0.07, cy + dir[1] * s * 0.07, s * 0.04, '#f6c9d6', '#efc873')
    })
  }
  ctx.restore()
}

// --- frame (mat + optional decoration) ------------------------------

function drawFrame(ctx, frame, img, w, h) {
  const x = -w / 2
  const y = -h / 2
  const s = Math.min(w, h)

  if (frame === 'none') {
    drawFit(ctx, img, x, y, w, h)
    return
  }
  if (frame === 'thin') {
    drawFit(ctx, img, x, y, w, h)
    ctx.strokeStyle = '#2b2b2e'
    ctx.lineWidth = Math.max(2, s * 0.014)
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
    return
  }

  const decor = DECOR_FRAMES.has(frame)
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
  drawFit(ctx, img, ix, iy, iw, ih)

  if (frame === 'double') {
    ctx.strokeStyle = 'rgba(43,43,46,0.55)'
    ctx.lineWidth = Math.max(1, s * 0.006)
    const g = pad * 0.4
    ctx.strokeRect(ix - g, iy - g, iw + g * 2, ih + g * 2)
  }
  if (decor) drawDecor(ctx, frame, x, y, w, h)
}

// Data URL of just the decoration, for the live editor overlay.
const _ovlCache = new Map()
export function renderFrameOverlay(frame, aspect) {
  const ar = Math.max(0.3, Math.min(3, aspect || 1))
  const key = `${frame}|${ar.toFixed(2)}`
  if (_ovlCache.has(key)) return _ovlCache.get(key)
  const w = 520
  const h = Math.round(w / ar)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  drawDecor(canvas.getContext('2d'), frame, 0, 0, w, h)
  const url = canvas.toDataURL('image/png')
  _ovlCache.set(key, url)
  return url
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

async function ensureFonts(layers) {
  const fams = new Set(['Inter', TITLE_FONT])
  layers.filter((l) => l.kind === 'text').forEach((l) => fams.add(l.font))
  try {
    await Promise.all([...fams].map((f) => document.fonts.load(`600 64px "${f}"`)))
    await document.fonts.ready
  } catch {
    /* fall back to serif / sans */
  }
}

// bgImg: loaded HTMLImageElement (the AI/uploaded background).
// layers: normalized (0..1) coords.
export async function renderCalendar(bgImg, layers, photoImgs, { year, position, panel, panelAlpha }) {
  await ensureFonts(layers)
  const templateImg = bgImg
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
  drawCalendarGrid(ctx, { year, W, H, position, panel, panelAlpha })

  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Could not render the calendar.'))),
      'image/jpeg',
      0.92
    )
  )
}
