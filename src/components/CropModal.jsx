import { useEffect, useRef, useState } from 'react'
import './CropModal.css'

// Reusable crop tool: drag a box (move + 8-way free resize, or 4 corners
// locked to a fixed ratio), then hand the parent a JPEG blob of the crop.
//   <CropModal src={url} title="…" onCancel={fn} onApply={async (blob) => {…}} />
// The parent unmounts the modal when onApply resolves.

const MIN = 24 // smallest crop box, in on-screen px
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const FREE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const LOCK_HANDLES = ['nw', 'ne', 'se', 'sw']

// `aspect` (w / h) forces every crop to that ratio — used to fit an
// uploaded image to a fixed print format.
export default function CropModal({ src, title = 'Crop', aspect = null, onCancel, onApply }) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const drag = useRef(null)

  const [disp, setDisp] = useState(null)
  const [crop, setCrop] = useState(null)
  const [lock, setLock] = useState(aspect != null)
  const [ratio, setRatio] = useState(aspect != null ? aspect : 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  useEffect(() => {
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth) onImgLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onImgLoad() {
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
    if (aspect != null) {
      let cw = w
      let ch = w / aspect
      if (ch > h) {
        ch = h
        cw = h * aspect
      }
      setCrop({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch })
    } else {
      setCrop({ x: 0, y: 0, w, h })
    }
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
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error('Could not render the crop.'))),
          'image/jpeg',
          0.95
        )
      )
      await onApply(blob)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  const natW = crop && disp ? Math.round(crop.w * disp.toNaturalX) : 0
  const natH = crop && disp ? Math.round(crop.h * disp.toNaturalY) : 0
  const handles = lock ? LOCK_HANDLES : FREE_HANDLES

  return (
    <div className="cropm" onClick={busy ? undefined : onCancel}>
      <div className="cropm__box" onClick={(e) => e.stopPropagation()}>
        <div className="cropm__head">
          <strong>{title}</strong>
          <button className="cropm__x" onClick={onCancel} disabled={busy} aria-label="Close">
            ×
          </button>
        </div>

        <div
          className="cropm__stage"
          ref={wrapRef}
          style={disp ? { width: disp.w, height: disp.h } : undefined}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            className="cropm__img"
            onLoad={onImgLoad}
            onError={() => setError('Could not load this image.')}
            draggable={false}
          />
          {crop && disp && (
            <>
              <div className="cropm__mask" style={{ left: 0, top: 0, width: '100%', height: crop.y }} />
              <div
                className="cropm__mask"
                style={{ left: 0, top: crop.y + crop.h, width: '100%', bottom: 0 }}
              />
              <div className="cropm__mask" style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }} />
              <div
                className="cropm__mask"
                style={{ left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }}
              />
              <div
                className="cropm__rect"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                onPointerDown={(e) => startDrag('move', null, e)}
              >
                {handles.map((h) => (
                  <span
                    key={h}
                    className={`cropm__h cropm__h--${h}`}
                    onPointerDown={(e) => startDrag('resize', h, e)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {aspect == null && (
          <label className="cropm__lock">
            <input type="checkbox" checked={lock} onChange={(e) => toggleLock(e.target.checked)} />
            Keep proportions (lock aspect ratio)
          </label>
        )}

        {error && <p className="cropm__err">{error}</p>}

        <div className="cropm__foot">
          <span className="cropm__dims">
            {natW} × {natH} px
          </span>
          <span className="cropm__spacer" />
          <button className="cropm__btn cropm__btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="cropm__btn" onClick={apply} disabled={busy || !crop}>
            {busy ? 'Working…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
