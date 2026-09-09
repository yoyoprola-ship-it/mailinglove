import { useEffect, useMemo, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import CropModal from '../components/CropModal'
import { mpTrack } from '../metaPixel'
import { trackEvent } from '../track'

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const PREVIEW_W = 360
let uid = 0

// The crop is a ready-made JPEG (from CropModal), tagged with its pixel
// size. It's only usable while its aspect ratio still matches the chosen
// format — otherwise we fall back to a centred crop of the original.
const RATIO_EPS = 0.02
const crop4For = (photo, ratio) =>
  photo.crop4 && Math.abs(photo.crop4.w / photo.crop4.h - ratio) < RATIO_EPS ? photo.crop4 : null

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Could not read an image.'))
    im.src = src
  })
}

// --- geometry helpers ---------------------------------------------------

function orientOf(photo, f) {
  const square = f.w === f.h
  const landscape = !square && photo.orientation === 'landscape'
  const wIn = landscape ? f.h : f.w
  const hIn = landscape ? f.w : f.h
  return { square, landscape, wIn, hIn, ratio: wIn / hIn }
}

// Largest centred rectangle of the given ratio inside a W×H image — the
// fallback crop when the customer hasn't used the box tool yet.
function centerCrop(W, H, ratio) {
  if (!W || !H) return { x: 0, y: 0, w: 0, h: 0 }
  let w = W
  let h = W / ratio
  if (h > H) {
    h = H
    w = H * ratio
  }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
}

function drawCrop(canvas, img, crop, outW, outH) {
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  if (crop.w) ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH)
}

// --- thumbnail --------------------------------------------------------

function PhotoThumb({ photo, format, active, onClick, onRemove }) {
  const ref = useRef(null)
  const { ratio, landscape, square } = orientOf(photo, format)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const w = 120
    const h = Math.round(120 / ratio)
    const c4 = crop4For(photo, ratio)
    if (c4) {
      const im = new Image()
      im.onload = () => {
        cv.width = w
        cv.height = h
        const g = cv.getContext('2d')
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, w, h)
        g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, w, h)
      }
      im.src = c4.url
      return
    }
    drawCrop(cv, photo.img, centerCrop(photo.w, photo.h, ratio), w, h)
  }, [photo, ratio])
  return (
    <div
      className={`pp__thumb${active ? ' is-active' : ''}${photo.configured ? ' is-done' : ''}`}
    >
      <button type="button" onClick={onClick} aria-label="Edit this photo">
        <canvas ref={ref} />
      </button>
      <button type="button" className="pp__thumb-x" onClick={onRemove} aria-label="Remove">
        ×
      </button>
      <span className="pp__thumb-fmt">
        {photo.configured && <span className="pp__thumb-check">✓</span>}
        {format.label}
        {!square && (landscape ? ' · landscape' : ' · portrait')}
      </span>
    </div>
  )
}

// --- section ---------------------------------------------------------

export default function PhotoPrint({
  formats10 = [],
  formatsCatalog = [],
  signedIn,
  onAdded,
  onRequireAuth,
}) {
  const [photos, setPhotos] = useState([]) // { id, img, w, h, url, formatId, orientation, configured, crop4? }
  const [activeId, setActiveId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | adding
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [justAdded, setJustAdded] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)

  const previewCanvasRef = useRef(null)
  const addFileRef = useRef(null)
  const addedTimer = useRef(null)
  const dragDepth = useRef(0)
  // Snapshot of the photo taken when its editor opened, so Cancel can
  // either discard it (never confirmed before) or revert it.
  const preEditRef = useRef(null)

  // Two envelope groups, but most logic just needs "all the formats".
  const formats = useMemo(() => [...formats10, ...formatsCatalog], [formats10, formatsCatalog])

  // 4×6 leads the list and is the default pick when it's offered.
  const is4x6 = (f) =>
    !!f && (f.id === '4x6' || (Math.min(f.w, f.h) === 4 && Math.max(f.w, f.h) === 6))
  const lead4x6 = (arr) => [...arr].sort((a, b) => (is4x6(b) ? 1 : 0) - (is4x6(a) ? 1 : 0))
  const shown10 = useMemo(() => lead4x6(formats10), [formats10])
  const shownCatalog = useMemo(() => lead4x6(formatsCatalog), [formatsCatalog])
  const defFormat = (formats.find(is4x6) || formats[0])?.id || ''
  const active = photos.find((p) => p.id === activeId) || null
  const format = useMemo(
    () => (active ? formats.find((f) => f.id === active.formatId) || formats[0] : formats[0]),
    [active, formats]
  )
  const geo = active && format ? orientOf(active, format) : null
  const activeCrop = active && geo ? crop4For(active, geo.ratio) : null
  const srcW = active && geo ? (activeCrop ? activeCrop.w : centerCrop(active.w, active.h, geo.ratio).w) : 0
  const lowRes = active && geo && srcW > 0 && srcW < geo.wIn * 150

  const total = photos.reduce((n, p) => {
    const f = formats.find((x) => x.id === p.formatId) || formats[0]
    return n + (f?.priceCents || 0)
  }, 0)

  function patchActive(patch) {
    setPhotos((list) => list.map((p) => (p.id === activeId ? { ...p, ...patch } : p)))
  }

  // Photos still needing a look, other than the one on screen.
  const pendingCount = photos.filter((p) => p.id !== activeId && !p.configured).length

  // Next photo (besides `id`) that still needs a look, or null if none.
  function nextPendingAfter(id) {
    const idx = photos.findIndex((p) => p.id === id)
    const after = photos.slice(idx + 1).find((p) => !p.configured)
    const before = photos.slice(0, idx).find((p) => !p.configured)
    return (after || before)?.id || null
  }

  // Snapshot the photo whenever a new one opens for editing.
  useEffect(() => {
    if (!activeId) return
    setCropOpen(false)
    const p = photos.find((x) => x.id === activeId)
    if (!p) return
    preEditRef.current = {
      id: activeId,
      wasConfigured: p.configured,
      formatId: p.formatId,
      orientation: p.orientation,
      crop4: p.crop4 || null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // "Done": confirm this photo and move on to the next pending one, or
  // close the editor if it was the last.
  function finishEditing() {
    const next = nextPendingAfter(activeId)
    setPhotos((list) => list.map((p) => (p.id === activeId ? { ...p, configured: true } : p)))
    setActiveId(next)
  }

  // Store the crop the box tool produced.
  async function applyCrop(blob) {
    const url = URL.createObjectURL(blob)
    let dims = { w: 0, h: 0 }
    try {
      const im = await loadImg(url)
      dims = { w: im.naturalWidth, h: im.naturalHeight }
    } catch {
      /* keep 0×0 — crop4For will just reject it */
    }
    setPhotos((list) =>
      list.map((p) => {
        if (p.id !== activeId) return p
        if (p.crop4) URL.revokeObjectURL(p.crop4.url)
        return { ...p, crop4: { url, w: dims.w, h: dims.h } }
      })
    )
    setCropOpen(false)
  }

  // "Cancel": discard a photo that was never confirmed, or revert one
  // that was already configured back to how it was.
  function cancelEditing() {
    const id = activeId
    if (!id) return
    const snap = preEditRef.current
    const next = nextPendingAfter(id)
    if (!snap || snap.id !== id || !snap.wasConfigured) {
      setPhotos((list) => {
        const gone = list.find((p) => p.id === id)
        if (gone) {
          URL.revokeObjectURL(gone.url)
          if (gone.crop4) URL.revokeObjectURL(gone.crop4.url)
        }
        return list.filter((p) => p.id !== id)
      })
    } else {
      setPhotos((list) =>
        list.map((p) => {
          if (p.id !== id) return p
          if (p.crop4 && p.crop4 !== snap.crop4) URL.revokeObjectURL(p.crop4.url)
          return { ...p, formatId: snap.formatId, orientation: snap.orientation, crop4: snap.crop4 || null }
        })
      )
    }
    setActiveId(next)
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
                configured: false,
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
      if (gone) {
        URL.revokeObjectURL(gone.url)
        if (gone.crop4) URL.revokeObjectURL(gone.crop4.url)
      }
      if (activeId === id) setActiveId(next[0]?.id || null)
      return next
    })
  }

  function reset() {
    photos.forEach((p) => {
      URL.revokeObjectURL(p.url)
      if (p.crop4) URL.revokeObjectURL(p.crop4.url)
    })
    setPhotos([])
    setActiveId(null)
    setStatus('idle')
    setProgress('')
    setError('')
  }

  // Draw an exact preview of the crop that would be sent — the box-tool
  // result if it's still valid, else the centred fallback.
  useEffect(() => {
    const cv = previewCanvasRef.current
    if (!cv || !active || !geo) return
    const cw = PREVIEW_W
    const ch = Math.round(PREVIEW_W / geo.ratio)
    const c4 = crop4For(active, geo.ratio)
    if (!c4) {
      drawCrop(cv, active.img, centerCrop(active.w, active.h, geo.ratio), cw, ch)
      return
    }
    let cancelled = false
    loadImg(c4.url)
      .then((im) => {
        if (cancelled) return
        cv.width = cw
        cv.height = ch
        const g = cv.getContext('2d')
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, cw, ch)
        g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, cw, ch)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, geo])

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
        const c4 = crop4For(p, g.ratio)
        const canvas = document.createElement('canvas')
        let outW
        let outH
        if (c4) {
          // The box tool already cut the photo to the right ratio; just
          // scale it into the print size.
          const im = await loadImg(c4.url)
          outW = Math.max(600, Math.round(Math.min(g.wIn * 300, c4.w, 3000)))
          outH = Math.round(outW / g.ratio)
          canvas.width = outW
          canvas.height = outH
          const cx = canvas.getContext('2d')
          cx.fillStyle = '#ffffff'
          cx.fillRect(0, 0, outW, outH)
          cx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, outW, outH)
        } else {
          const c = centerCrop(p.w, p.h, g.ratio)
          outW = Math.max(600, Math.round(Math.min(g.wIn * 300, c.w, 3000)))
          outH = Math.round(outW / g.ratio)
          drawCrop(canvas, p.img, c, outW, outH)
        }
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
      mpTrack('AddToCart', {
        content_type: 'product',
        content_name: 'Photo prints',
        num_items: photos.length,
        value: total / 100,
        currency: 'USD',
      })
      trackEvent('add_to_cart', { valueCents: total })
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

  const dropLabel = (
    <label className="pp__drop">
      <Icon name="upload" size={26} />
      <span>
        {justAdded ? 'Added to cart ✓ — choose more photos' : 'Choose photos or drag them here'}
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />
    </label>
  )

  return (
    <section className="section" id="photo-print">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Print your photos</p>
          <h2 className="section__title">Print your photos and mail them</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Upload one photo or many, pick a size, and crop each one. We print each
            at full quality and mail it — to you or straight to someone you love.
            Price per print, printing and US mailing included:
          </p>
          <ul className="pp__pricelist">
            {[...shown10, ...shownCatalog].map((f) => (
              <li key={f.id} className="pp__pricechip">
                <strong>{f.label}</strong>
                <span>{money(f.priceCents)}</span>
              </li>
            ))}
          </ul>
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
              {!active && dropLabel}

              {active && geo && (
                <div className="pp__seq">
                  <div className="pp__seq-head">
                    <strong>Edit this photo</strong>
                    {pendingCount > 0 && <span className="pp__muted">{pendingCount} more to go</span>}
                  </div>

                  <div className="pp__crop4">
                    <canvas
                      ref={previewCanvasRef}
                      className="pp__canvas"
                      style={{ width: PREVIEW_W, maxWidth: '100%', height: 'auto' }}
                    />
                    {!activeCrop && <span className="pp__crop4-tag">Not cropped yet</span>}
                  </div>

                  <button
                    type="button"
                    className="btn btn--ghost pp__crop4-btn"
                    onClick={() => setCropOpen(true)}
                  >
                    {activeCrop ? 'Crop again' : `Crop to ${format.label}`}
                  </button>
                  <p className="pp__hint">
                    The box stays locked to the {format.label} shape. This preview is exactly
                    what we'll print.
                  </p>
                  {lowRes && !activeCrop && (
                    <p className="pp__warn">
                      ⚠ This photo is a little low-resolution for {format.label} — it may
                      look soft in print.
                    </p>
                  )}

                  <div className="pp__block">
                    <span className="pp__label">Format</span>

                    {formats10.length > 0 && (
                      <>
                        <span className="pp__group-label">Fits a #10 envelope</span>
                        <div className="pp__formats">
                          {shown10.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className={`pp__format${f.id === active.formatId ? ' is-active' : ''}`}
                              onClick={() => patchActive({ formatId: f.id })}
                            >
                              <strong>{f.label}</strong>
                              <span>{money(f.priceCents)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {formatsCatalog.length > 0 && (
                      <>
                        <span className="pp__group-label">Needs a catalog envelope</span>
                        <div className="pp__formats">
                          {shownCatalog.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className={`pp__format${f.id === active.formatId ? ' is-active' : ''}`}
                              onClick={() => patchActive({ formatId: f.id })}
                            >
                              <strong>{f.label}</strong>
                              <span>{money(f.priceCents)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {!geo.square && (
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

                  <div className="pp__seq-foot">
                    <button type="button" className="btn btn--ghost" onClick={cancelEditing}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn--primary" onClick={finishEditing}>
                      Done
                    </button>
                  </div>
                </div>
              )}

              {cropOpen && active && geo && (
                <CropModal
                  src={active.url}
                  title={`Crop to ${format.label}`}
                  aspect={geo.ratio}
                  onCancel={() => setCropOpen(false)}
                  onApply={applyCrop}
                />
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
