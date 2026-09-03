import { useEffect, useMemo, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import {
  FRAMES,
  FONTS,
  POSITIONS,
  PANELS,
  renderCalendar,
  renderGridDataUrl,
} from './calendarRender'

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
let uid = 0

const mctx = document.createElement('canvas').getContext('2d')
function sizeTextLayer(l, ratio) {
  const refH = 1000
  const px = l.size * refH
  mctx.font = `600 ${px}px "${l.font}", serif`
  const lines = String(l.text || ' ').split('\n')
  const wpx = Math.max(1, ...lines.map((s) => mctx.measureText(s || ' ').width))
  return { ...l, w: (wpx * 1.06) / (refH * ratio), h: l.size * 1.18 * lines.length }
}

export default function CalendarMaker({
  year = 2027,
  priceCents = 0,
  signedIn,
  onAdded,
  onRequireAuth,
}) {
  // --- background (AI or uploaded) ---
  const [scene, setScene] = useState('')
  const [bg, setBg] = useState('')
  const [bgImg, setBgImg] = useState(null)
  const [gen, setGen] = useState('idle') // idle | working
  const [genErr, setGenErr] = useState('')

  // --- calendar placement (customer's choice) ---
  const [position, setPosition] = useState('bottom')
  const [panel, setPanel] = useState('light')
  const [gridUrl, setGridUrl] = useState('')

  // --- editor ---
  const [layers, setLayers] = useState([])
  const [selId, setSelId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | adding | done
  const [error, setError] = useState('')

  const stageRef = useRef(null)
  const fileRef = useRef(null)
  const bgFileRef = useRef(null)
  const drag = useRef(null)
  const photoEls = useRef({})

  const ratio = bgImg ? bgImg.naturalWidth / bgImg.naturalHeight : 0.8
  const sel = layers.find((l) => l.id === selId) || null

  useEffect(() => {
    if (!bg) return setBgImg(null)
    const im = new Image()
    im.onload = () => setBgImg(im)
    im.src = bg
  }, [bg])

  useEffect(() => {
    if (!bgImg) return
    const r = bgImg.naturalWidth / bgImg.naturalHeight
    const w = 900
    const draw = () => setGridUrl(renderGridDataUrl(w, Math.round(w / r), year, position, panel))
    draw()
    if (document.fonts?.ready) document.fonts.ready.then(draw).catch(() => {})
  }, [bgImg, position, panel, year])

  useEffect(() => {
    function move(e) {
      const d = drag.current
      if (!d || !stageRef.current) return
      const rr = stageRef.current.getBoundingClientRect()
      const dxN = (e.clientX - d.px) / rr.width
      const dyN = (e.clientY - d.py) / rr.height
      setLayers((ls) =>
        ls.map((l) => {
          if (l.id !== d.id) return l
          if (d.mode === 'move') {
            return { ...l, x: clamp(d.s.x + dxN, -0.25, 1.25), y: clamp(d.s.y + dyN, -0.25, 1.25) }
          }
          if (d.mode === 'resize') {
            return { ...l, w: Math.max(0.06, d.s.w + dxN), h: Math.max(0.06, d.s.h + dyN) }
          }
          if (d.mode === 'rotate') {
            const cx = rr.left + (l.x + l.w / 2) * rr.width
            const cy = rr.top + (l.y + l.h / 2) * rr.height
            const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90
            return { ...l, rot: Math.round(ang) }
          }
          return l
        })
      )
    }
    function up() {
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  // --- background generation ---

  async function generate() {
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    if (!scene.trim()) {
      setGenErr('Describe the background you want.')
      return
    }
    setGen('working')
    setGenErr('')
    try {
      const res = await fetch('/api/calendar-background', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: scene.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Something went wrong.')
      resetEditor()
      setBg(d.image)
    } catch (err) {
      setGenErr(err.message)
    } finally {
      setGen('idle')
    }
  }

  function uploadBg(file) {
    if (!file || !file.type.startsWith('image/')) return
    resetEditor()
    setBg(URL.createObjectURL(file))
  }

  function resetEditor() {
    setLayers([])
    setSelId(null)
    setStatus('idle')
    setError('')
    photoEls.current = {}
  }

  function changeBg() {
    setBg('')
    setBgImg(null)
    setGridUrl('')
    resetEditor()
  }

  // --- layers ---

  function startDrag(mode, l, e) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setSelId(l.id)
    drag.current = { mode, id: l.id, px: e.clientX, py: e.clientY, s: { x: l.x, y: l.y, w: l.w, h: l.h } }
  }

  const nextZ = () => (layers.length ? Math.max(...layers.map((l) => l.z)) + 1 : 1)

  function addPhotos(list) {
    const files = [...(list || [])].filter((f) => f.type.startsWith('image/'))
    files.forEach((file, i) => {
      const id = `l${++uid}`
      const url = URL.createObjectURL(file)
      const im = new Image()
      im.onload = () => {
        photoEls.current[id] = im
        const w = 0.34
        const h = clamp(w * ratio * (im.naturalHeight / im.naturalWidth), 0.1, 0.7)
        setLayers((ls) => [
          ...ls,
          {
            id,
            kind: 'photo',
            src: url,
            frame: 'white',
            x: 0.5 - w / 2 + i * 0.03,
            y: 0.16 + i * 0.03,
            w,
            h,
            rot: 0,
            z: nextZ() + i,
          },
        ])
        setSelId(id)
      }
      im.src = url
    })
  }

  function addText() {
    const id = `l${++uid}`
    const base = {
      id,
      kind: 'text',
      text: 'Your text',
      font: 'Great Vibes',
      size: 0.06,
      color: '#ffffff',
      shadow: true,
      outline: false,
      x: 0.5,
      y: 0.2,
      w: 0.3,
      h: 0.08,
      rot: 0,
      z: nextZ(),
    }
    const sized = sizeTextLayer(base, ratio)
    sized.x = 0.5 - sized.w / 2
    setLayers((ls) => [...ls, sized])
    setSelId(id)
  }

  function patchSel(patch) {
    setLayers((ls) =>
      ls.map((l) => {
        if (l.id !== selId) return l
        const next = { ...l, ...patch }
        return next.kind === 'text' ? sizeTextLayer(next, ratio) : next
      })
    )
  }
  function removeSel() {
    setLayers((ls) => ls.filter((l) => l.id !== selId))
    delete photoEls.current[selId]
    setSelId(null)
  }
  function bringFront() {
    patchSel({ z: nextZ() })
  }
  function sendBack() {
    patchSel({ z: Math.min(...layers.map((l) => l.z)) - 1 })
  }

  async function addToCart() {
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    if (!bgImg) return
    setStatus('adding')
    setError('')
    setSelId(null)
    try {
      const blob = await renderCalendar(bgImg, layers, photoEls.current, { year, position, panel })
      const body = new FormData()
      body.append('image', blob, 'calendar.jpg')
      body.append('width', String(bgImg.naturalWidth))
      body.append('height', String(bgImg.naturalHeight))
      const res = await fetch('/api/cart/calendar', {
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
      setStatus('idle')
    }
  }

  const ordered = useMemo(() => [...layers].sort((a, b) => a.z - b.z), [layers])
  const hasText = layers.some((l) => l.kind === 'text')

  return (
    <section className="section section--dark" id="calendar">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Make your own</p>
          <h2 className="section__title section__title--light">Build a {year} photo calendar</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead section__lead--light">
            Describe a background, choose where the months go, drop in your photos
            with a frame, and add a line of your own. 8×10&nbsp;in — printed and
            mailed like everything else.
          </p>
        </Reveal>

        <Reveal delay={120}>
          {!bg ? (
            <div className="cme__intro">
              <label className="studio__label" htmlFor="cme-scene">
                Background
              </label>
              <input
                id="cme-scene"
                className="cpc__input"
                maxLength={120}
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                placeholder="e.g. a field of wildflowers at dawn, a soft galaxy, a cosy cabin"
              />
              <div className="cme__intro-actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={generate}
                  disabled={gen === 'working'}
                >
                  {gen === 'working'
                    ? 'Generating…'
                    : signedIn
                      ? 'Generate background'
                      : 'Sign in to start'}
                </button>
                <button
                  type="button"
                  className="cme__link"
                  onClick={() => bgFileRef.current?.click()}
                >
                  or upload your own
                </button>
                <input
                  ref={bgFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => uploadBg(e.target.files?.[0])}
                />
              </div>
              {gen === 'working' && <p className="studio__note">This takes 15–30 seconds.</p>}
              {genErr && <p className="studio__error">{genErr}</p>}
            </div>
          ) : (
            <div className="cme">
              <div className="cme__main">
                <div
                  className="cme__stage"
                  ref={stageRef}
                  style={{ aspectRatio: String(ratio) }}
                  onPointerDown={() => setSelId(null)}
                >
                  {bg && <img className="cme__bg" src={bg} alt="" draggable={false} />}
                  {ordered.map((l) => (
                    <div
                      key={l.id}
                      className={`cme__layer${l.id === selId ? ' is-sel' : ''}`}
                      style={{
                        left: `${l.x * 100}%`,
                        top: `${l.y * 100}%`,
                        width: `${l.w * 100}%`,
                        height: `${l.h * 100}%`,
                        transform: `rotate(${l.rot}deg)`,
                        zIndex: l.z + 10,
                      }}
                      onPointerDown={(e) => startDrag('move', l, e)}
                    >
                      {l.kind === 'photo' ? (
                        <div className={`cme__photo cme__photo--${l.frame}`}>
                          <img src={l.src} alt="" draggable={false} />
                        </div>
                      ) : (
                        <span
                          className="cme__text"
                          style={{
                            fontFamily: `"${l.font}", serif`,
                            fontSize: `${l.size * 100}cqh`,
                            color: l.color,
                            textShadow: l.shadow ? '0 0.4cqh 1.2cqh rgba(0,0,0,0.5)' : 'none',
                            WebkitTextStroke: l.outline
                              ? `0.12cqh ${l.color === '#ffffff' ? 'rgba(0,0,0,0.65)' : '#ffffff'}`
                              : '0',
                          }}
                        >
                          {l.text}
                        </span>
                      )}
                      {l.id === selId && (
                        <>
                          <span
                            className="cme__handle cme__handle--rot"
                            onPointerDown={(e) => startDrag('rotate', l, e)}
                          />
                          {l.kind === 'photo' && (
                            <span
                              className="cme__handle cme__handle--se"
                              onPointerDown={(e) => startDrag('resize', l, e)}
                            />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {gridUrl && <img className="cme__grid" src={gridUrl} alt="" draggable={false} />}
                </div>

                <button type="button" className="cme__change" onClick={changeBg}>
                  ← New background
                </button>
              </div>

              <div className="cme__side">
                <div className="cme__group">
                  <span className="cme__group-t">Calendar placement</span>
                  <div className="cme__seg">
                    {POSITIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`cme__seg-b${position === p.id ? ' is-active' : ''}`}
                        onClick={() => setPosition(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="cme__seg">
                    {PANELS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`cme__seg-b${panel === p.id ? ' is-active' : ''}`}
                        onClick={() => setPanel(p.id)}
                      >
                        {p.label} panel
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cme__add">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="image" size={15} /> Add photo
                  </button>
                  {!hasText && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={addText}>
                      <Icon name="sparkles" size={15} /> Add text
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) => {
                      addPhotos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>

                {!sel && (
                  <p className="cme__hint">
                    Tap a photo or the text to edit it. Drag to move, corner to resize,
                    top dot to rotate.
                  </p>
                )}

                {sel && (
                  <div className="cme__tools">
                    <div className="cme__tool-row">
                      <button type="button" className="cme__chip" onClick={bringFront}>
                        Front
                      </button>
                      <button type="button" className="cme__chip" onClick={sendBack}>
                        Back
                      </button>
                      <button type="button" className="cme__chip cme__chip--danger" onClick={removeSel}>
                        Delete
                      </button>
                    </div>

                    <label className="cme__field">
                      Rotation
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        value={sel.rot}
                        onChange={(e) => patchSel({ rot: Number(e.target.value) })}
                      />
                    </label>

                    {sel.kind === 'photo' && (
                      <div className="cme__frames">
                        {FRAMES.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            title={f.label}
                            className={`cme__frame cme__frame--${f.id}${sel.frame === f.id ? ' is-active' : ''}`}
                            onClick={() => patchSel({ frame: f.id })}
                          >
                            <span />
                          </button>
                        ))}
                      </div>
                    )}

                    {sel.kind === 'text' && (
                      <>
                        <textarea
                          className="cme__textarea"
                          rows={2}
                          value={sel.text}
                          onChange={(e) => patchSel({ text: e.target.value })}
                        />
                        <label className="cme__field">
                          Font
                          <select value={sel.font} onChange={(e) => patchSel({ font: e.target.value })}>
                            {FONTS.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="cme__field">
                          Size
                          <input
                            type="range"
                            min={0.03}
                            max={0.16}
                            step={0.005}
                            value={sel.size}
                            onChange={(e) => patchSel({ size: Number(e.target.value) })}
                          />
                        </label>
                        <div className="cme__tool-row">
                          <label className="cme__color">
                            <input
                              type="color"
                              value={sel.color}
                              onChange={(e) => patchSel({ color: e.target.value })}
                            />
                            Colour
                          </label>
                          <label className="cme__toggle">
                            <input
                              type="checkbox"
                              checked={sel.shadow}
                              onChange={(e) => patchSel({ shadow: e.target.checked })}
                            />
                            Shadow
                          </label>
                          <label className="cme__toggle">
                            <input
                              type="checkbox"
                              checked={sel.outline}
                              onChange={(e) => patchSel({ outline: e.target.checked })}
                            />
                            Outline
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  className="btn btn--primary cme__cta"
                  type="button"
                  onClick={addToCart}
                  disabled={status === 'adding' || status === 'done'}
                >
                  {status === 'adding'
                    ? 'Adding…'
                    : status === 'done'
                      ? 'Added ✓'
                      : !signedIn
                        ? 'Sign in to add to cart'
                        : priceCents > 0
                          ? `Add to cart · ${money(priceCents)}`
                          : 'Add to cart'}
                </button>
                {status === 'done' && (
                  <p className="cme__ok">
                    In your cart. <a href="/account?tab=cart">View cart</a>
                  </p>
                )}
                {error && <p className="studio__error">{error}</p>}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  )
}
