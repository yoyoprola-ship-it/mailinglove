import { useEffect, useMemo, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const PREVIEW_W = 360
let uid = 0

// --- geometry helpers ---------------------------------------------------

function orientOf(photo, f) {
  const square = f.w === f.h
  const landscape = !square && photo.orientation === 'landscape'
  const wIn = landscape ? f.h : f.w
  const hIn = landscape ? f.w : f.h
  return { square, landscape, wIn, hIn, ratio: wIn / hIn }
}

// Crop rectangle in source pixels for a photo at its format/zoom/pan.
function cropOf(photo, ratio) {
  const { w: W, h: H } = photo
  if (!W) return { x: 0, y: 0, w: 0, h: 0 }
  let h = H / photo.zoom
  let w = h * ratio
  if (w > W) {
    w = W
    h = w / ratio
  }
  if (h > H) {
    h = H
    w = h * ratio
  }
  const cx = Math.min(Math.max(photo.cx, w / 2), W - w / 2)
  const cy = Math.min(Math.max(photo.cy, h / 2), H - h / 2)
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function drawCrop(canvas, photo, crop, outW, outH) {
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  if (crop.w) ctx.drawImage(photo.img, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)
}

// --- thumbnail --------------------------------------------------------

function PhotoThumb({ photo, format, active, onClick, onRemove }) {
  const ref = useRef(null)
  const { ratio } = orientOf(photo, format)
  useEffect(() => {
    if (ref.current) drawCrop(ref.current, photo, cropOf(photo, ratio), 120, Math.round(120 / ratio))
  }, [photo, ratio])
  return (
    <div className={`pp__thumb${active ? ' is-active' : ''}`}>
      <button type="button" onClick={onClick} aria-label="Edit this photo">
        <canvas ref={ref} />
      </button>
      <button type="button" className="pp__thumb-x" onClick={onRemove} aria-label="Remove">
        ×
      </button>
    </div>
  )
}

// --- section ---------------------------------------------------------

export default function PhotoPrint({ formats = [], signedIn, onAdded, onRequireAuth }) {
  const [photos, setPhotos] = useState([]) // { id, img, w, h, url, formatId, orientation, zoom, cx, cy }
  const [activeId, setActiveId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | adding
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [justAdded, setJustAdded] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const previewRef = useRef(null)
  const drag = useRef(null)
  const addFileRef = useRef(null)
  const addedTimer = useRef(null)
  const dragDepth = useRef(0)

  const defFormat = formats[0]?.id || ''
  const active = photos.find((p) => p.id === activeId) || null
  const format = useMemo(
    () => (active ? formats.find((f) => f.id === active.formatId) || formats[0] : formats[0]),
    [active, formats]
  )
  const geo = active && format ? orientOf(active, format) : null
  const crop = active && geo ? cropOf(active, geo.ratio) : { x: 0, y: 0, w: 0, h: 0 }
  const lowRes = active && geo && crop.w > 0 && crop.w < geo.wIn * 150

  const total = photos.reduce((n, p) => {
    const f = formats.find((x) => x.id === p.formatId) || formats[0]
    return n + (f?.priceCents || 0)
  }, 0)

  function patchActive(patch) {
    setPhotos((list) => list.map((p) => (p.id === activeId ? { ...p, ...patch } : p)))
  }

  function addFiles(fileList) {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setError('')
    setJustAdded(false)
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const url = URL.createObjectURL(file)
            const im = new Image()
            im.onload = () =>
              resolve({
                id: `p${++uid}`,
                img: im,
                url,
                w: im.naturalWidth,
                h: im.naturalHeight,
                formatId: defFormat,
                orientation: im.naturalWidth > im.naturalHeight ? 'landscape' : 'portrait',
                zoom: 1,
                cx: im.naturalWidth / 2,
                cy: im.naturalHeight / 2,
              })
            im.onerror = () => resolve(null)
            im.src = url
          })
      )
    ).then((loaded) => {
      const ok = loaded.filter(Boolean)
      if (!ok.length) {
        setError('Could not read those images.')
        return
      }
      setPhotos((list) => [...list, ...ok])
      setActiveId((cur) => cur || ok[0].id)
    })
  }

  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files')
  function onDragEnter(e) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }
  function onDragOver(e) {
    if (hasFiles(e)) e.preventDefault()
  }
  function onDragLeave(e) {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }
  function onDrop(e) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  function removePhoto(id) {
    setPhotos((list) => {
      const next = list.filter((p) => p.id !== id)
      const gone = list.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      if (activeId === id) setActiveId(next[0]?.id || null)
      return next
    })
  }

  function reset() {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])
    setActiveId(null)
    setStatus('idle')
    setProgress('')
    setError('')
    drag.current = null
  }

  // Redraw the active photo in the stage.
  useEffect(() => {
    const c = previewRef.current
    if (!c || !active || !geo) return
    drawCrop(c, active, crop, PREVIEW_W, Math.round(PREVIEW_W / geo.ratio))
  }, [active, geo, crop])

  function onPointerDown(e) {
    if (!active) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = { px: e.clientX, py: e.clientY, cx: active.cx, cy: active.cy, w: rect.width || PREVIEW_W }
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const scale = crop.w / d.w
    patchActive({
      cx: d.cx - (e.clientX - d.px) * scale,
      cy: d.cy - (e.clientY - d.py) * scale,
    })
  }
  function onPointerUp() {
    drag.current = null
  }

  async function addToCart() {
    if (!photos.length) return
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    setStatus('adding')
    setError('')
    let lastItems = null
    try {
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Adding ${i + 1} / ${photos.length}…`)
        const p = photos[i]
        const f = formats.find((x) => x.id === p.formatId) || formats[0]
        const g = orientOf(p, f)
        const c = cropOf(p, g.ratio)
        const outW = Math.max(600, Math.round(Math.min(g.wIn * 300, c.w, 3000)))
        const outH = Math.round(outW / g.ratio)
        const canvas = document.createElement('canvas')
        drawCrop(canvas, p, c, outW, outH)
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95))
        if (!blob) throw new Error('Could not render an image.')

        const body = new FormData()
        body.append('image', blob, `photo-${f.id}.jpg`)
        body.append('formatId', f.id)
        body.append('orientation', g.landscape ? 'landscape' : 'portrait')
        body.append('width', String(outW))
        body.append('height', String(outH))
        const r = await fetch('/api/cart/photo', { method: 'POST', credentials: 'same-origin', body })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'Could not add to cart.')
        lastItems = d.items
      }
      onAdded?.(lastItems)
      reset()
      setJustAdded(true)
      clearTimeout(addedTimer.current)
      addedTimer.current = setTimeout(() => setJustAdded(false), 5000)
    } catch (err) {
      setError(err.message)
      setStatus('idle')
      setProgress('')
    }
  }

  useEffect(() => () => clearTimeout(addedTimer.current), [])

  if (!formats.length) return null

  return (
    <section className="section" id="photo-print">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Print your photos</p>
          <h2 className="section__title">Print your photos and mail them</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Upload one photo or many, pick a size, and crop each one. We print them
            at full quality and mail them — to you or straight to someone you love.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div
            className={`pp${dragOver ? ' is-dragover' : ''}`}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {dragOver && <div className="pp__drophint">Drop photos to add them</div>}
            <div className="pp__stage">
              {active && geo ? (
                <canvas
                  ref={previewRef}
                  className="pp__canvas"
                  style={{ width: PREVIEW_W, height: Math.round(PREVIEW_W / geo.ratio) }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
              ) : (
                <label className="pp__drop">
                  <Icon name="upload" size={26} />
                  <span>
                    {justAdded
                      ? 'Added to cart ✓ — choose more photos'
                      : 'Choose photos or drag them here'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
              )}

              {active && (
                <>
                  <label className="pp__zoom">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={active.zoom}
                      onChange={(e) => patchActive({ zoom: Number(e.target.value) })}
                    />
                  </label>
                  <p className="pp__hint">Drag the photo to reposition it in the frame.</p>
                  {lowRes && (
                    <p className="pp__warn">
                      ⚠ This photo is a little low-resolution for {format.label} — it may
                      look soft in print.
                    </p>
                  )}
                </>
              )}

              {photos.length > 0 && (
                <div className="pp__strip">
                  {photos.map((p) => (
                    <PhotoThumb
                      key={p.id}
                      photo={p}
                      format={formats.find((f) => f.id === p.formatId) || formats[0]}
                      active={p.id === activeId}
                      onClick={() => setActiveId(p.id)}
                      onRemove={() => removePhoto(p.id)}
                    />
                  ))}
                  <button
                    type="button"
                    className="pp__addmore"
                    onClick={() => addFileRef.current?.click()}
                    aria-label="Add more photos"
                  >
                    +
                  </button>
                  <input
                    ref={addFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>
              )}
            </div>

            <div className="pp__controls">
              <div className="pp__block">
                <span className="pp__label">
                  Format {photos.length > 1 && <em className="pp__muted">· for the selected photo</em>}
                </span>
                <div className="pp__formats">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`pp__format${active && f.id === active.formatId ? ' is-active' : ''}`}
                      onClick={() => patchActive({ formatId: f.id })}
                      disabled={!active}
                    >
                      <strong>{f.label}</strong>
                      <span>{money(f.priceCents)}</span>
                    </button>
                  ))}
                </div>

                {active && geo && !geo.square && (
                  <div className="pp__orient">
                    <span className="pp__label">Orientation</span>
                    <div className="pp__row">
                      <button
                        type="button"
                        className={`pp__opt${!geo.landscape ? ' is-active' : ''}`}
                        onClick={() => patchActive({ orientation: 'portrait' })}
                      >
                        ▯ Portrait
                      </button>
                      <button
                        type="button"
                        className={`pp__opt${geo.landscape ? ' is-active' : ''}`}
                        onClick={() => patchActive({ orientation: 'landscape' })}
                      >
                        ▭ Landscape
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pp__foot">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={addToCart}
                  disabled={!photos.length || status === 'adding'}
                >
                  {status === 'adding'
                    ? progress || 'Adding…'
                    : !signedIn
                      ? 'Sign in to add to cart'
                      : `Add ${photos.length || ''} photo${photos.length === 1 ? '' : 's'} to cart${
                          total > 0 ? ` · ${money(total)}` : ''
                        }`}
                </button>
                {photos.length > 0 && (
                  <button type="button" className="pp__replace" onClick={reset}>
                    Clear all
                  </button>
                )}
                {justAdded && (
                  <p className="pp__ok">
                    Added ✓ <a href="/account?tab=cart">Go to cart</a> — or upload more above.
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
