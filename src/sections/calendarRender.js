// Photo-calendar compositor: templates are admin-uploaded background images
// (grid + dates baked in); the customer stacks framed photos and styled
// text on top. The DOM editor and this canvas exporter must agree, so the
// frame geometry here matches the CSS in App.css (.cme__photo--*).

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

// Draw a cover-fitted photo into (ix,iy,iw,ih).
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

// Frame drawn centred on the current origin, outer box w×h.
function drawFrame(ctx, frame, img, w, h) {
  const x = -w / 2
  const y = -h / 2
  const s = Math.min(w, h)
  const soft = () => {
    ctx.shadowColor = 'rgba(0,0,0,0.30)'
    ctx.shadowBlur = s * 0.06
    ctx.shadowOffsetY = s * 0.03
  }
  const clearShadow = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

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
  soft()
  if (frame === 'shadowbox') {
    ctx.shadowBlur = s * 0.1
    ctx.shadowOffsetY = s * 0.05
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  clearShadow()
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

export async function ensureFonts(layers) {
  const used = [...new Set(layers.filter((l) => l.kind === 'text').map((l) => l.font))]
  try {
    await Promise.all(used.map((f) => document.fonts.load(`600 64px "${f}"`)))
    await document.fonts.ready
  } catch {
    /* fonts will fall back to serif */
  }
}

// templateImg: a loaded HTMLImageElement. layers: normalized (0..1) coords.
export async function renderCalendar(templateImg, layers, photoImgs) {
  await ensureFonts(layers)
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

  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not render the calendar.'))), 'image/jpeg', 0.92)
  )
}
