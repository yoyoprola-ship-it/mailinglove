import { useEffect, useState } from 'react'
import Reveal from '../components/Reveal'
import catalog from '../data/postcards.json'

const PER_PAGE = 25

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

export default function Postcards({ filter, onFilter, onAdd }) {
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState(null)

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

  const cards = catalog.postcards.filter(
    (p) => p.type === activeType.id && (!filter.sub || p.subcategory === filter.sub)
  )

  const pageCount = Math.max(1, Math.ceil(cards.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const shown = cards.slice((current - 1) * PER_PAGE, current * PER_PAGE)

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
                  <button
                    className="btn btn--primary btn--sm"
                    type="button"
                    onClick={() => onAdd(p)}
                  >
                    Add
                  </button>
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
              <button
                className="btn btn--primary btn--sm"
                type="button"
                onClick={() => {
                  onAdd(preview)
                  setPreview(null)
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
