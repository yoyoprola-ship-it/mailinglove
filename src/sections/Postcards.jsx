import { useState } from 'react'
import Reveal from '../components/Reveal'
import catalog from '../data/postcards.json'

export default function Postcards() {
  const [cat, setCat] = useState('all')
  const cards =
    cat === 'all' ? catalog.postcards : catalog.postcards.filter((p) => p.category === cat)

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
          <button
            className={`pc-chip${cat === 'all' ? ' is-active' : ''}`}
            onClick={() => setCat('all')}
          >
            All
          </button>
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              className={`pc-chip${cat === c.id ? ' is-active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="pc-grid">
          {cards.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 60}>
              <article className="pc-card">
                <img className="pc-card__img" src={p.image} alt={p.title} loading="lazy" />
                <div className="pc-card__body">
                  <h3 className="pc-card__title">{p.title}</h3>
                  <a className="btn btn--primary btn--sm" href={`/account?add=${p.id}`}>
                    Send this postcard
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
