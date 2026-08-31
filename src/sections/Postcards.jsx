import Reveal from '../components/Reveal'
import catalog from '../data/postcards.json'

export default function Postcards({ filter, onFilter }) {
  const activeType = catalog.types.find((t) => t.id === filter.type) || catalog.types[0]
  const subs = activeType.subcategories

  const cards = catalog.postcards.filter(
    (p) => p.type === activeType.id && (!filter.sub || p.subcategory === filter.sub)
  )

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

        <div className="pc-grid">
          {cards.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 50}>
              <article className="pc-card">
                <img className="pc-card__img" src={p.image} alt={p.title} loading="lazy" />
                <div className="pc-card__body">
                  <h3 className="pc-card__title">{p.title}</h3>
                  <a className="btn btn--primary btn--sm" href={`/account?add=${p.id}`}>
                    Add
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
          {!cards.length && <p className="section__lead">No designs here yet.</p>}
        </div>
      </div>
    </section>
  )
}
