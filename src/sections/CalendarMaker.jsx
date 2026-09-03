import { useEffect, useMemo, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import { FRAMES, FONTS, renderCalendar } from './calendarRender'

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
  const [templates, setTemplates] = useState(null)
  const [tpl, setTpl] = useState(null)
  const [tplImg, setTplImg] = useState(null)
  const [layers, setLayers] = useState([])
  const [selId, setSelId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | adding | done
  const [error, setError] = useState('')

  const stageRef = useRef(null)
  const fileRef = useRef(null)
  const drag = useRef(null)
  const photoEls = useRef({})

  const ratio = tplImg ? tplImg.naturalWidth / tplImg.naturalHeight : 0.8
  const sel = layers.find((l) => l.id === selId) || null

  useEffect(() => {
    fetch('/api/calendar-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    if (!tpl) return
    setTplImg(null)
    const im = new Image()
    im.onload = () => setTplImg(im)
    im.src = tpl.image
  }, [tpl])

  useEffect(() => {
    function move(e) {
      const d = drag.current
      if (!d || !stageRef.current) return
      const r = stageRef.current.getBoundingClientRect()
      const dxN = (e.clientX - d.px) / r.width
      const dyN = (e.clientY - d.py) / r.height
      setLayers((ls) =>
        ls.map((l) => {
          if (l.id !== d.id) return l
          if (d.mode === 'move') {
            return { ...l, x: clamp(d.s.x + dxN, -0.25, 1.25), y: clamp(d.s.y + dyN, -0.25, 1.25) }
          }
          if (d.mode === 'resize') {
            const nw = Math.max(0.06, d.s.w + dxN)
            const nh = Math.max(0.06, d.s.h + dyN)
            return { ...l, w: nw, h: nh }
          }
          if (d.mode === 'rotate') {
            const cx = r.left + (l.x + l.w / 2) * r.width
            const cy = r.top + (l.y + l.h / 2) * r.height
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
            y: 0.32 + i * 0.03,
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
      size: 0.07,
      color: '#ffffff',
      shadow: true,
      outline: false,
      x: 0.5,
      y: 0.5,
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
    if (photoEls.current[selId]) delete photoEls.current[selId]
    setSelId(null)
  }

  function bringFront() {
    patchSel({ z: nextZ() })
  }
  function sendBack() {
    const minZ = Math.min(...layers.map((l) => l.z))
    patchSel({ z: minZ - 1 })
  }

  function changeTemplate() {
    setTpl(null)
    setLayers([])
    setSelId(null)
    setStatus('idle')
    photoEls.current = {}
  }

  async function addToCart() {
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    if (!tplImg || !layers.length) {
      setError('Add at least one photo or text first.')
      return
    }
    setStatus('adding')
    setError('')
    setSelId(null)
    try {
      const blob = await renderCalendar(tplImg, layers, photoEls.current)
      const body = new FormData()
      body.append('image', blob, 'calendar.jpg')
      body.append('width', String(tplImg.naturalWidth))
      body.append('height', String(tplImg.naturalHeight))
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

  return (
    <section className="section section--dark" id="calendar">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Make your own</p>
          <h2 className="section__title section__title--light">Build a {year} photo calendar</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead section__lead--light">
            Pick a design, drop your photos in, frame them, and add your own words.
            8×10&nbsp;in — printed and mailed like everything else.
          </p>
        </Reveal>

        <Reveal delay={120}>
          {templates && !templates.length ? (
            <p className="section__lead section__lead--light">Calendars are coming soon.</p>
          ) : !tpl ? (
            <div className="cme__pick">
              {(templates || []).map((t) => (
                <button key={t.id} type="button" className="cme__pick-card" onClick={() => setTpl(t)}>
                  <img src={t.image} alt={t.name} loading="lazy" />
                  <span>{t.name}</span>
                </button>
              ))}
              {!templates && <p className="section__lead section__lead--light">Loading…</p>}
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
                  {tpl && <img className="cme__bg" src={tpl.image} alt="" draggable={false} />}
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
                </div>

                <button type="button" className="cme__change" onClick={changeTemplate}>
                  ← Change design
                </button>
              </div>

              <div className="cme__side">
                <div className="cme__add">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
                    <Icon name="image" size={15} /> Add photo
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={addText}>
                    <Icon name="sparkles" size={15} /> Add text
                  </button>
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

                {!sel && <p className="cme__hint">Tap a photo or text to edit it. Drag to move, corner to resize, top dot to rotate.</p>}

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
                          <select
                            value={sel.font}
                            onChange={(e) => patchSel({ font: e.target.value })}
                          >
                            {FONTS.map((f) => (
                              <option key={f.id} value={f.id} style={{ fontFamily: `"${f.id}"` }}>
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
