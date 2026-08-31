import { useEffect, useMemo, useState } from 'react'
import Reveal from '../components/Reveal'
import bundledCatalog from '../data/postcards.json'

// Deterministic shuffle: same order all day for every visitor, a fresh
// order tomorrow — so the catalog feels like it's restocked daily. Stable
// within the day so paging back and forth never repeats or skips a design.
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(arr, seedStr) {
  const rng = mulberry32(hashStr(seedStr))
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function Pager({ current, pageCount, onGo }) {
  if (pageCount <= 1) return null
  return (
    <div className="pc-pager">
      <button className="pc-pager__btn" onClick={() => onGo(current - 1)} disabled={current === 1}>
        ‹ Prev
      </button>
      <span className="pc-pager__status">
        Page {current} / {pageCount}
      </span>
      <button
        className="pc-pager__btn"
        onClick={() => onGo(current + 1)}
        disabled={current === pageCount}
      >
        Next ›
      </button>
    </div>
  )
}

function CartControl({ qty, onAdd, onDec }) {
  if (qty > 0) {
    return (
      <span className="pc-stepper">
        <button type="button" onClick={onDec} aria-label="Remove one">
          −
        </button>
        <span className="pc-stepper__n">{qty}</span>
        <button type="button" onClick={onAdd} aria-label="Add one">
          +
        </button>
      </span>
    )
  }
  return (
    <button className="btn btn--primary btn--sm" type="button" onClick={onAdd}>
      Add
    </button>
  )
}

export default function Postcards({
  filter,
  onFilter,
  onAdd,
  onDec,
  cartQtyFor = () => 0,
  perPage = 25,
}) {
  const [page, setPage] = useState(1)
  const size = perPage > 0 ? perPage : 25
  const [preview, setPreview] = useState(null)

  // Catalog is editable from the admin panel, so pull the live version;
  // fall back to the copy bundled at build time if the request fails.
  const [catalog, setCatalog] = useState(bundledCatalog)
  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (c && Array.isArray(c.postcards) && Array.isArray(c.types)) setCatalog(c)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!preview) return
    function onKey(e) {
      if (e.key === 'Escape') setPreview(null)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [preview])

  const activeType = catalog.types.find((t) => t.id === filter.type) || catalog.types[0]
  const subs = activeType.subcategories

  const cards = useMemo(() => {
    const filtered = catalog.postcards.filter(
      (p) => p.type === activeType.id && (!filter.sub || p.subcategory === filter.sub)
    )
    const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    return seededShuffle(filtered, `${day}|${activeType.id}|${filter.sub || 'all'}`)
  }, [catalog, activeType.id, filter.sub])

  const pageCount = Math.max(1, Math.ceil(cards.length / size))
  const current = Math.min(page, pageCount)
  const shown = cards.slice((current - 1) * size, current * size)

  // Back to page 1 whenever the filter changes.
  useEffect(() => {
    setPage(1)
  }, [filter.type, filter.sub])

  function goPage(n) {
    setPage(n)
    document.getElementById('postcards')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="section" id="postcards">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Ready-made postcards</p>
          <h2 className="section__title">Pick one, we print it and mail it</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Choose a design, add your message and who it's going to. We print it,
            put it in an envelope, and send it — to you or straight to them.
          </p>
        </Reveal>

        <div className="pc-filter">
          {catalog.types.map((t) => (
            <button
              key={t.id}
              className={`pc-chip${t.id === activeType.id ? ' is-active' : ''}`}
              onClick={() => onFilter({ type: t.id, sub: null })}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subs.length > 0 && (
          <div className="pc-subfilter">
            <button
              className={`pc-subchip${!filter.sub ? ' is-active' : ''}`}
              onClick={() => onFilter({ type: activeType.id, sub: null })}
            >
              All
            </button>
            {subs.map((s) => (
              <button
                key={s.id}
                className={`pc-subchip${filter.sub === s.id ? ' is-active' : ''}`}
                onClick={() => onFilter({ type: activeType.id, sub: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <Pager current={current} pageCount={pageCount} onGo={goPage} />

        <div className="pc-grid">
          {shown.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 50}>
              <article className="pc-card">
                <button
                  type="button"
                  className="pc-card__imgbtn"
                  onClick={() => setPreview(p)}
                  aria-label={`Preview ${p.title}`}
                >
                  <img className="pc-card__img" src={p.image} alt={p.title} loading="lazy" />
                </button>
                <div className="pc-card__body">
                  <h3 className="pc-card__title">{p.title}</h3>
                  <CartControl
                    qty={cartQtyFor(p.id)}
                    onAdd={() => onAdd(p)}
                    onDec={() => onDec(p)}
                  />
                </div>
              </article>
            </Reveal>
          ))}
          {!cards.length && <p className="section__lead">No designs here yet.</p>}
        </div>

        <Pager current={current} pageCount={pageCount} onGo={goPage} />
      </div>

      {preview && (
        <div
          className="pc-modal"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.title}
        >
          <div className="pc-modal__box" onClick={(e) => e.stopPropagation()}>
            <button
              className="pc-modal__close"
              onClick={() => setPreview(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <img className="pc-modal__img" src={preview.image} alt={preview.title} />
            <div className="pc-modal__foot">
              <span className="pc-modal__title">{preview.title}</span>
              <CartControl
                qty={cartQtyFor(preview.id)}
                onAdd={() => onAdd(preview)}
                onDec={() => onDec(preview)}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
