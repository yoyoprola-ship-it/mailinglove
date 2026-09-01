import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`

// Curated "pretty" fonts. `fallback` keeps the canvas render sane before the
// web font arrives.
const FONTS = [
  { name: 'Playfair Display', fallback: 'Georgia, serif', kind: 'serif' },
  { name: 'Cormorant Garamond', fallback: 'Georgia, serif', kind: 'serif' },
  { name: 'Lora', fallback: 'Georgia, serif', kind: 'serif' },
  { name: 'Montserrat', fallback: 'Arial, sans-serif', kind: 'sans' },
  { name: 'Dancing Script', fallback: 'cursive', kind: 'script' },
  { name: 'Great Vibes', fallback: 'cursive', kind: 'script' },
  { name: 'Pacifico', fallback: 'cursive', kind: 'script' },
  { name: 'Sacramento', fallback: 'cursive', kind: 'script' },
  { name: 'Lobster', fallback: 'cursive', kind: 'script' },
  { name: 'Caveat', fallback: 'cursive', kind: 'script' },
]
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,600&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,600&family=Lora:ital,wght@0,400;0,600;0,700;1,600&family=Montserrat:wght@400;500;600;700;800&family=Dancing+Script:wght@400;600;700&family=Great+Vibes&family=Pacifico&family=Sacramento&family=Lobster&family=Caveat:wght@400;600;700&display=swap'

const fontMeta = (name) => FONTS.find((f) => f.name === name) || FONTS[0]
const cssFont = (t, px) =>
  `${t.italic ? 'italic ' : ''}${t.weight || 700} ${px}px "${t.font}", ${fontMeta(t.font).fallback}`

const POSITIONS = [
  ['↖', 8, 10], ['↑', 50, 10], ['↗', 92, 10],
  ['←', 8, 50], ['•', 50, 50], ['→', 92, 50],
  ['↙', 8, 90], ['↓', 50, 90], ['↘', 92, 90],
]

const PREVIEW_W = 360
let fontsInjected = false

function newText() {
  return {
    id: Math.random().toString(36).slice(2, 9),
    text: 'Your text',
    font: 'Playfair Display',
    sizePct: 9,
    color: '#ffffff',
    weight: 700,
    italic: false,
    shadow: true,
    align: 'center',
    rotation: 0,
    xPct: 50,
    yPct: 88,
  }
}

export default function PhotoPrint({ formats = [], signedIn, onAdded, onRequireAuth }) {
  const [formatId, setFormatId] = useState(formats[0]?.id || '')
  const [img, setImg] = useState(null) // HTMLImageElement
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const [texts, setTexts] = useState([])
  const [selId, setSelId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | adding | done | error
  const [error, setError] = useState('')

  const previewRef = useRef(null)
  const drag = useRef(null)
  const boundsRef = useRef({}) // { [textId]: {x0,y0,x1,y1} } in 0..1 of the canvas
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  const format = useMemo(
    () => formats.find((f) => f.id === formatId) || formats[0],
    [formats, formatId]
  )
  const ratio = format ? format.w / format.h : 1
  const sel = texts.find((t) => t.id === selId) || null

  // Load the fonts once.
  useEffect(() => {
    if (fontsInjected || typeof document === 'undefined') return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
    fontsInjected = true
  }, [])

  // Keep the selected format valid if the admin list changes.
  useEffect(() => {
    if (formats.length && !formats.some((f) => f.id === formatId)) setFormatId(formats[0].id)
  }, [formats, formatId])

  // The crop rectangle in source pixels, derived from format ratio + zoom,
  // clamped to stay inside the image.
  const crop = useMemo(() => {
    if (!dims.w) return { x: 0, y: 0, w: 0, h: 0 }
    let h = dims.h / zoom
    let w = h * ratio
    if (w > dims.w) {
      w = dims.w
      h = w / ratio
    }
    if (h > dims.h) {
      h = dims.h
      w = h * ratio
    }
    const cx = Math.min(Math.max(center.x, w / 2), dims.w - w / 2)
    const cy = Math.min(Math.max(center.y, h / 2), dims.h - h / 2)
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  }, [dims, zoom, ratio, center])

  const draw = useCallback(
    (canvas, outW, outH, interactive = false) => {
      if (!canvas || !img || !crop.w) return
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)

      const s = Math.max(1, outW / PREVIEW_W) // px scale vs the on-screen preview

      for (const t of texts) {
        const fontPx = (t.sizePct / 100) * outH
        const x = (t.xPct / 100) * outW
        const y = (t.yPct / 100) * outH
        const rot = ((t.rotation || 0) * Math.PI) / 180

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rot)
        ctx.font = cssFont(t, fontPx)
        ctx.fillStyle = t.color
        ctx.textAlign = t.align
        ctx.textBaseline = 'middle'

        const lines = String(t.text).split('\n')
        const widest = Math.max(1, ...lines.map((l) => ctx.measureText(l || ' ').width))
        const blockH = (lines.length - 1) * fontPx * 1.2
        const padX = fontPx * 0.2
        const padY = fontPx * 0.7
        // local box, relative to the rotate origin
        const lLeft = t.align === 'left' ? 0 : t.align === 'right' ? -widest : -widest / 2
        const lx0 = lLeft - padX
        const lx1 = lLeft + widest + padX
        const ly0 = -blockH / 2 - padY
        const ly1 = blockH / 2 + padY

        if (t.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.45)'
          ctx.shadowBlur = fontPx * 0.14
          ctx.shadowOffsetY = fontPx * 0.06
        }
        lines.forEach((line, i) => {
          ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * fontPx * 1.2)
        })
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        if (interactive && t.id === selId) {
          const bw = lx1 - lx0
          const bh = ly1 - ly0
          ctx.fillStyle = 'rgba(184,53,95,0.10)'
          ctx.fillRect(lx0, ly0, bw, bh)
          ctx.lineJoin = 'round'
          ctx.setLineDash([])
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'
          ctx.lineWidth = 4 * s
          ctx.strokeRect(lx0, ly0, bw, bh)
          ctx.strokeStyle = '#b8355f'
          ctx.lineWidth = 2 * s
          ctx.setLineDash([9 * s, 5 * s])
          ctx.strokeRect(lx0, ly0, bw, bh)
          ctx.setLineDash([])
          const hs = 4.5 * s
          for (const [hx, hy] of [
            [lx0, ly0],
            [lx1, ly0],
            [lx0, ly1],
            [lx1, ly1],
          ]) {
            ctx.fillStyle = '#fff'
            ctx.fillRect(hx - hs - s, hy - hs - s, (hs + s) * 2, (hs + s) * 2)
            ctx.fillStyle = '#b8355f'
            ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2)
          }
        }
        ctx.restore()

        // axis-aligned bounds in canvas space (for pointer hit testing)
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)
        const xs = []
        const ys = []
        for (const [cxp, cyp] of [
          [lx0, ly0],
          [lx1, ly0],
          [lx1, ly1],
          [lx0, ly1],
        ]) {
          xs.push(x + cxp * cos - cyp * sin)
          ys.push(y + cxp * sin + cyp * cos)
        }
        boundsRef.current[t.id] = {
          x0: Math.min(...xs) / outW,
          y0: Math.min(...ys) / outH,
          x1: Math.max(...xs) / outW,
          y1: Math.max(...ys) / outH,
        }
      }
    },
    [img, crop, texts, selId]
  )

  // Redraw the on-screen preview.
  useEffect(() => {
    const c = previewRef.current
    if (!c || !img) return
    const outW = PREVIEW_W
    const outH = Math.round(PREVIEW_W / ratio)
    draw(c, outW, outH, true)
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all(texts.map((t) => document.fonts.load(cssFont(t, 40)).catch(() => {})))
        .then(() => draw(c, outW, outH, true))
        .catch(() => {})
    }
  }, [draw, img, ratio, texts])

  function pickFile(file) {
    if (!file) return
    setError('')
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      setImg(im)
      setDims({ w: im.naturalWidth, h: im.naturalHeight })
      setCenter({ x: im.naturalWidth / 2, y: im.naturalHeight / 2 })
      setZoom(1)
      setStatus('idle')
    }
    im.onerror = () => setError('Could not read that image.')
    im.src = url
  }

  // Drag a text layer if the pointer landed on one, otherwise pan the photo.
  function onPointerDown(e) {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const w = rect.width || PREVIEW_W
    const h = rect.height || Math.round(PREVIEW_W / ratio)
    const u = (e.clientX - rect.left) / w
    const v = (e.clientY - rect.top) / h

    // topmost text first
    const hit = [...texts].reverse().find((t) => {
      const b = boundsRef.current[t.id]
      return b && u >= b.x0 && u <= b.x1 && v >= b.y0 && v <= b.y1
    })

    if (hit) {
      setSelId(hit.id)
      drag.current = {
        mode: 'text',
        id: hit.id,
        px: e.clientX,
        py: e.clientY,
        x0: hit.xPct,
        y0: hit.yPct,
        w,
        h,
      }
    } else {
      drag.current = {
        mode: 'image',
        px: e.clientX,
        py: e.clientY,
        cx: center.x,
        cy: center.y,
        w,
      }
    }
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    if (d.mode === 'text') {
      const dx = ((e.clientX - d.px) / d.w) * 100
      const dy = ((e.clientY - d.py) / d.h) * 100
      patchText(d.id, {
        xPct: clamp(d.x0 + dx, 0, 100),
        yPct: clamp(d.y0 + dy, 0, 100),
      })
      return
    }
    const scale = crop.w / d.w // source px per rendered px
    setCenter({
      x: d.cx - (e.clientX - d.px) * scale,
      y: d.cy - (e.clientY - d.py) * scale,
    })
  }
  function onPointerUp() {
    drag.current = null
  }

  const patchText = (id, patch) =>
    setTexts((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const addText = () => {
    const t = newText()
    setTexts((list) => [...list, t])
    setSelId(t.id)
  }
  const removeText = (id) => {
    setTexts((list) => list.filter((t) => t.id !== id))
    if (selId === id) setSelId(null)
  }

  const lowRes = img && format && crop.w > 0 && crop.w < format.w * 150

  async function addToCart() {
    if (!img || !format) return
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    setStatus('adding')
    setError('')
    try {
      if (document.fonts) {
        await Promise.all(texts.map((t) => document.fonts.load(cssFont(t, 60)).catch(() => {})))
      }
      const outW = Math.max(600, Math.round(Math.min(format.w * 300, crop.w, 3000)))
      const outH = Math.round(outW / ratio)
      const canvas = document.createElement('canvas')
      draw(canvas, outW, outH)
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      )
      if (!blob) throw new Error('Could not render the image.')

      const body = new FormData()
      body.append('image', blob, `photo-${format.id}.jpg`)
      body.append('formatId', format.id)
      body.append('width', String(outW))
      body.append('height', String(outH))
      const res = await fetch('/api/cart/photo', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add to cart.')
      setStatus('done')
      onAdded?.(d.items)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  if (!format) return null

  return (
    <section className="section" id="photo-print">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Print your photos</p>
          <h2 className="section__title">Print your photos and mail them</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Upload a photo, pick a size, crop it, and add beautiful text. We print
            it at full quality and mail it — to you or straight to someone you love.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="pp">
            {/* left: preview */}
            <div className="pp__stage">
              {img ? (
                <canvas
                  ref={previewRef}
                  className="pp__canvas"
                  style={{ width: PREVIEW_W, height: Math.round(PREVIEW_W / ratio) }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              ) : (
                <label className="pp__drop">
                  <Icon name="upload" size={26} />
                  <span>Choose a photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              )}

              {img && (
                <>
                  <label className="pp__zoom">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                    />
                  </label>
                  <p className="pp__hint">
                    Drag the photo to reposition it — or drag a text layer to place it.
                  </p>
                  {lowRes && (
                    <p className="pp__warn">
                      ⚠ This photo is a little low-resolution for {format.label} — it may
                      look soft in print.
                    </p>
                  )}
                  <label className="pp__replace">
                    Replace photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      onChange={(e) => pickFile(e.target.files?.[0])}
                    />
                  </label>
                </>
              )}
            </div>

            {/* right: controls */}
            <div className="pp__controls">
              <div className="pp__block">
                <span className="pp__label">Format</span>
                <div className="pp__formats">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`pp__format${f.id === formatId ? ' is-active' : ''}`}
                      onClick={() => setFormatId(f.id)}
                    >
                      <strong>{f.label}</strong>
                      <span>{money(f.priceCents)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pp__block">
                <div className="pp__block-head">
                  <span className="pp__label">Text</span>
                  <button type="button" className="pp__add" onClick={addText} disabled={!img}>
                    + Add text
                  </button>
                </div>

                {texts.length === 0 && (
                  <p className="pp__muted">No text yet. Add a line and style it.</p>
                )}

                {texts.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`pp__textchip${t.id === selId ? ' is-active' : ''}`}
                    onClick={() => setSelId(t.id === selId ? null : t.id)}
                  >
                    <span style={{ fontFamily: `"${t.font}", ${fontMeta(t.font).fallback}` }}>
                      {t.text.split('\n')[0] || 'text'}
                    </span>
                    <span className="pp__x" onClick={(e) => (e.stopPropagation(), removeText(t.id))}>
                      ✕
                    </span>
                  </button>
                ))}

                {sel && (
                  <div className="pp__editor">
                    <textarea
                      className="pp__input pp__ta"
                      rows={2}
                      maxLength={120}
                      value={sel.text}
                      onChange={(e) => patchText(sel.id, { text: e.target.value })}
                    />

                    <div className="pp__grid2">
                      <label className="pp__f">
                        Font
                        <select
                          className="pp__input"
                          value={sel.font}
                          onChange={(e) => patchText(sel.id, { font: e.target.value })}
                        >
                          {FONTS.map((f) => (
                            <option key={f.name} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="pp__f">
                        Weight
                        <select
                          className="pp__input"
                          value={sel.weight}
                          onChange={(e) => patchText(sel.id, { weight: Number(e.target.value) })}
                        >
                          <option value={400}>Regular</option>
                          <option value={600}>Medium</option>
                          <option value={700}>Bold</option>
                          <option value={800}>Extra bold</option>
                        </select>
                      </label>
                    </div>

                    <div className="pp__grid2">
                      <label className="pp__f">
                        Size
                        <input
                          type="range"
                          min={3}
                          max={22}
                          step={0.5}
                          value={sel.sizePct}
                          onChange={(e) => patchText(sel.id, { sizePct: Number(e.target.value) })}
                        />
                      </label>
                      <label className="pp__f">
                        Color
                        <input
                          type="color"
                          className="pp__color"
                          value={sel.color}
                          onChange={(e) => patchText(sel.id, { color: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="pp__row">
                      {['left', 'center', 'right'].map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={`pp__opt${sel.align === a ? ' is-active' : ''}`}
                          onClick={() => patchText(sel.id, { align: a })}
                        >
                          {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
                        </button>
                      ))}
                      <label className="pp__check">
                        <input
                          type="checkbox"
                          checked={sel.italic}
                          onChange={(e) => patchText(sel.id, { italic: e.target.checked })}
                        />
                        Italic
                      </label>
                      <label className="pp__check">
                        <input
                          type="checkbox"
                          checked={sel.shadow}
                          onChange={(e) => patchText(sel.id, { shadow: e.target.checked })}
                        />
                        Shadow
                      </label>
                    </div>

                    <label className="pp__f">
                      <span className="pp__rot-head">
                        Rotate
                        <span className="pp__rot-val">{Math.round(sel.rotation || 0)}°</span>
                        <span className="pp__rot-quick">
                          {[-90, -45, 0, 45, 90].map((deg) => (
                            <button
                              key={deg}
                              type="button"
                              className={`pp__rot-btn${(sel.rotation || 0) === deg ? ' is-active' : ''}`}
                              onClick={() => patchText(sel.id, { rotation: deg })}
                            >
                              {deg > 0 ? `+${deg}` : deg}
                            </button>
                          ))}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={sel.rotation || 0}
                        onChange={(e) => patchText(sel.id, { rotation: Number(e.target.value) })}
                      />
                    </label>

                    <span className="pp__label">Position</span>
                    <div className="pp__pos">
                      {POSITIONS.map(([g, x, y]) => (
                        <button
                          key={g}
                          type="button"
                          className="pp__posbtn"
                          onClick={() => patchText(sel.id, { xPct: x, yPct: y })}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <label className="pp__f">
                      Nudge X
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={sel.xPct}
                        onChange={(e) => patchText(sel.id, { xPct: Number(e.target.value) })}
                      />
                    </label>
                    <label className="pp__f">
                      Nudge Y
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={sel.yPct}
                        onChange={(e) => patchText(sel.id, { yPct: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pp__foot">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={addToCart}
                  disabled={!img || status === 'adding'}
                >
                  {status === 'adding'
                    ? 'Adding…'
                    : !signedIn
                      ? 'Sign in to add to cart'
                      : `Add to cart · ${money(format.priceCents)}`}
                </button>
                {status === 'done' && (
                  <p className="pp__ok">
                    Added ✓ <a href="/account?tab=cart">Go to cart</a> or tweak it and add
                    another.
                  </p>
                )}
                {error && <p className="pp__warn">{error}</p>}
                <p className="pp__muted">
                  Printed at up to 300 DPI. Delivery is ~3–9 business days after we hand
                  it to USPS.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
