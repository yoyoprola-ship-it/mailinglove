import { useEffect, useMemo, useRef } from 'react'
import bundled from '../data/postcards.json'
import { trackEvent } from '../track'

// A slow, finger-draggable marquee of random postcard designs under the
// service chooser. Tapping (not dragging) goes to /postcards.
function pickRandom(arr, n) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

const SPEED_PX_PER_SEC = 32

export default function PostcardStrip() {
  const cards = useMemo(() => pickRandom(bundled.postcards || [], 14), [])
  const scrollerRef = useRef(null)
  const paused = useRef(false)
  const down = useRef(null)
  const dragged = useRef(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    let raf
    let last = performance.now()

    function tick(now) {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      if (!reduce && !paused.current) el.scrollLeft += SPEED_PX_PER_SEC * dt
      // Seamless loop: the list is doubled, so wrap at half its width.
      const half = el.scrollWidth / 2
      if (half > 0) {
        if (el.scrollLeft >= half) el.scrollLeft -= half
        else if (el.scrollLeft <= 0) el.scrollLeft += half
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!cards.length) return null
  const loop = [...cards, ...cards]

  const onPointerDown = (e) => {
    down.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    dragged.current = false
    paused.current = true
  }
  const onPointerMove = (e) => {
    if (down.current && Math.abs(e.clientX - down.current.x) > 8) dragged.current = true
  }
  const endPointer = () => {
    down.current = null
    paused.current = false
  }
  const onClick = (e) => {
    if (dragged.current) {
      e.preventDefault()
      return
    }
    trackEvent('choose_postcards')
  }

  return (
    <section className="pstrip" aria-label="Browse ready-made postcards">
      <a
        className="pstrip__track"
        ref={scrollerRef}
        href="/postcards"
        aria-label="Browse all postcards"
        draggable="false"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onClick={onClick}
      >
        {loop.map((p, i) => (
          <span className="pstrip__card" key={`${p.id}-${i}`} aria-hidden={i >= cards.length}>
            <img
              src={`/api/postcard-image/${p.id}`}
              alt=""
              loading={i < 8 ? 'eager' : 'lazy'}
              draggable="false"
            />
          </span>
        ))}
      </a>
    </section>
  )
}
