import { useEffect, useRef, useState } from 'react'

// Admin crop tool. Loads the card's current image, lets you drag a crop
// box (move + 8-way resize for a free crop, or 4 corners locked to a
// fixed ratio), then bakes the crop client-side and posts it to the
// existing hi-res override endpoint.

const MIN = 24 // smallest crop box, in on-screen px
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const FREE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const LOCK_HANDLES = ['nw', 'ne', 'se', 'sw']

export default function CropModal({ card, onClose, onDone }) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const drag = useRef(null)

  const [disp, setDisp] = useState(null) // { w, h, scale } — displayed size + natural/display ratio
  const [crop, setCrop] = useState(null) // { x, y, w, h } in displayed px
  const [lock, setLock] = useState(false)
  const [ratio, setRatio] = useState(1) // locked aspect (w / h)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // One set of window listeners for the component's life. They read the
  // live drag session from the `drag` ref, so re-renders can never leave a
  // stale handler registered (that was dropping the vertical resize).
  useEffect(() => {
    function onMove(e) {
      const d = drag.current
      if (!d) return
      const disp = d.disp
      const dx = e.clientX - d.px
      const dy = e.clientY - d.py

      if (d.mode === 'move') {
        setCrop({
          ...d.start,
          x: clamp(d.start.x + dx, 0, disp.w - d.start.w),
          y: clamp(d.start.y + dy, 0, disp.h - d.start.h),
        })
        return
      }

      const h = d.handle
      if (d.lock) {
        // anchor at the opposite corner, keep the locked ratio
        const ratio = d.ratio
        const right = d.start.x + d.start.w
        const bottom = d.start.y + d.start.h
        const ax = h.includes('e') ? d.start.x : right
        const ay = h.includes('s') ? d.start.y : bottom
        const pointerX = clamp(e.clientX - d.rect.left, 0, disp.w)
        const pointerY = clamp(e.clientY - d.rect.top, 0, disp.h)
        let nw = Math.abs(pointerX - ax)
        let nh = Math.abs(pointerY - ay)
        if (nw / nh > ratio) nh = nw / ratio
        else nw = nh * ratio
        const dirX = h.includes('e') ? 1 : -1
        const dirY = h.includes('s') ? 1 : -1
        nw = Math.min(nw, dirX > 0 ? disp.w - ax : ax)
        nh = Math.min(nh, dirY > 0 ? disp.h - ay : ay)
        if (nw / nh > ratio) nw = nh * ratio
        else nh = nw / ratio
        if (nw < MIN || nh < MIN) return
        setCrop({ x: dirX > 0 ? ax : ax - nw, y: dirY > 0 ? ay : ay - nh, w: nw, h: nh })
        return
      }

      let nx = d.start.x
      let ny = d.start.y
      let nr = d.start.x + d.start.w
      let nb = d.start.y + d.start.h
      if (h.includes('w')) nx = clamp(d.start.x + dx, 0, nr - MIN)
      if (h.includes('e')) nr = clamp(nr + dx, nx + MIN, disp.w)
      if (h.includes('n')) ny = clamp(d.start.y + dy, 0, nb - MIN)
      if (h.includes('s')) nb = clamp(nb + dy, ny + MIN, disp.h)
      setCrop({ x: nx, y: ny, w: nr - nx, h: nb - ny })
    }
    function endDrag() {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // If the image was already cached, `load` may never fire — seed from it.
  useEffect(() => {
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth) onImgLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onImgLoad() {
    // Initialise once — a re-fired load event must not wipe the user's crop.
    if (crop) return
    const el = imgRef.current
    const nw = el.naturalWidth
    const nh = el.naturalHeight
    const maxW = Math.min(window.innerWidth * 0.9, 640)
    const maxH = window.innerHeight * 0.62
    const scale = Math.min(maxW / nw, maxH / nh, 1)
    const w = Math.round(nw * scale)
    const h = Math.round(nh * scale)
    setDisp({ w, h, toNaturalX: nw / w, toNaturalY: nh / h })
    // Start at the full image so you only ever pull edges inward.
    setCrop({ x: 0, y: 0, w, h })
  }

  function startDrag(mode, handle, e) {
    e.preventDefault()
    e.stopPropagation()
    if (!disp || !crop) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = {
      mode,
      handle,
      px: e.clientX,
      py: e.clientY,
      start: crop,
      disp,
      lock,
      ratio,
      rect: wrapRef.current.getBoundingClientRect(),
    }
  }

  function toggleLock(on) {
    setLock(on)
    if (on && crop) setRatio(crop.w / crop.h)
  }

  async function apply() {
    if (!disp || !crop) return
    setBusy(true)
    setError('')
    try {
      const { toNaturalX: kx, toNaturalY: ky } = disp
      const sw = Math.max(1, Math.round(crop.w * kx))
      const sh = Math.max(1, Math.round(crop.h * ky))
      const sx = clamp(Math.round(crop.x * kx), 0, imgRef.current.naturalWidth - sw)
      const sy = clamp(Math.round(crop.y * ky), 0, imgRef.current.naturalHeight - sh)
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      canvas.getContext('2d').drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh)
      const blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not render the crop.'))), 'image/jpeg', 0.95)
      )
      const body = new FormData()
      body.append('image', blob, `${card.id}.jpg`)
      const r = await fetch(`/api/admin/catalog/${card.id}/image`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Upload failed.')
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const natW = crop && disp ? Math.round(crop.w * disp.toNaturalX) : 0
  const natH = crop && disp ? Math.round(crop.h * disp.toNaturalY) : 0
  const handles = lock ? LOCK_HANDLES : FREE_HANDLES

  return (
    <div className="adm__crop" onClick={busy ? undefined : onClose}>
      <div className="adm__crop__box" onClick={(e) => e.stopPropagation()}>
        <div className="adm__crop__head">
          <strong>Crop — {card.title}</strong>
          <button className="adm__crop__x" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>

        <div
          className="adm__crop__stage"
          ref={wrapRef}
          style={disp ? { width: disp.w, height: disp.h } : undefined}
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <img
            ref={imgRef}
            src={card.image}
            alt=""
            className="adm__crop__img"
            onLoad={onImgLoad}
            onError={() => setError('Could not load this image.')}
            draggable={false}
          />
          {crop && disp && (
            <>
              <div
                className="adm__crop__mask"
                style={{ left: 0, top: 0, width: '100%', height: crop.y }}
              />
              <div
                className="adm__crop__mask"
                style={{ left: 0, top: crop.y + crop.h, width: '100%', bottom: 0 }}
              />
              <div
                className="adm__crop__mask"
                style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }}
              />
              <div
                className="adm__crop__mask"
                style={{ left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }}
              />
              <div
                className="adm__crop__rect"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                onPointerDown={(e) => startDrag('move', null, e)}
              >
                {handles.map((h) => (
                  <span
                    key={h}
                    className={`adm__crop__h adm__crop__h--${h}`}
                    onPointerDown={(e) => startDrag('resize', h, e)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <label className="adm__crop__lock">
          <input
            type="checkbox"
            checked={lock}
            onChange={(e) => toggleLock(e.target.checked)}
          />
          Keep proportions (lock aspect ratio)
        </label>

        {error && <p className="adm__error">{error}</p>}

        <div className="adm__crop__foot">
          <span className="adm__crop__dims">
            {natW} × {natH} px
          </span>
          <span className="adm__crop__spacer" />
          <button className="adm__chip" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="adm__btn" onClick={apply} disabled={busy || !crop}>
            {busy ? 'Saving…' : 'Apply crop'}
          </button>
        </div>
      </div>
    </div>
  )
}
