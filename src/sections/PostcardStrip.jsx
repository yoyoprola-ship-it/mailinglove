import { useMemo } from 'react'
import bundled from '../data/postcards.json'
import { trackEvent } from '../track'

// A slow marquee of random postcard designs under the service chooser.
// Tapping anywhere on it goes to /postcards.
function pickRandom(arr, n) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export default function PostcardStrip() {
  const cards = useMemo(() => pickRandom(bundled.postcards || [], 14), [])
  if (!cards.length) return null
  // Doubled so the -50% translate loops seamlessly.
  const loop = [...cards, ...cards]

  return (
    <section className="pstrip" aria-label="Browse ready-made postcards">
      <a
        className="pstrip__track"
        href="/postcards"
        aria-label="Browse all postcards"
        onClick={() => trackEvent('choose_postcards')}
      >
        {loop.map((p, i) => (
          <span className="pstrip__card" key={`${p.id}-${i}`} aria-hidden={i >= cards.length}>
            <img src={`/api/postcard-image/${p.id}`} alt="" loading="lazy" draggable="false" />
          </span>
        ))}
      </a>
    </section>
  )
}
