import { useState } from 'react'
import catalog from '../data/postcards.json'

// Slide-in catalog menu: postcard types, with Birthday expanding to its
// per-recipient subcategories. Picking one filters the Postcards gallery.
export default function MenuDrawer({ open, onClose, onNavigate }) {
  const [expanded, setExpanded] = useState('birthday')

  function pick(type, sub = null) {
    onNavigate(type, sub)
    onClose()
  }

  return (
    <>
      <div
        className={`drawer__scrim${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="drawer__head">
          <span className="drawer__title">Postcards</span>
          <button className="drawer__x" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className="drawer__nav">
          {catalog.types.map((t) => (
            <div key={t.id} className="drawer__group">
              <button
                className="drawer__type"
                onClick={() =>
                  t.subcategories.length
                    ? setExpanded(expanded === t.id ? '' : t.id)
                    : pick(t.id)
                }
              >
                <span>{t.label}</span>
                {t.subcategories.length > 0 && (
                  <span className="drawer__chev">{expanded === t.id ? '−' : '+'}</span>
                )}
              </button>

              {t.subcategories.length > 0 && expanded === t.id && (
                <div className="drawer__subs">
                  <button className="drawer__sub" onClick={() => pick(t.id)}>
                    All {t.label}
                  </button>
                  {t.subcategories.map((s) => (
                    <button
                      key={s.id}
                      className="drawer__sub"
                      onClick={() => pick(t.id, s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
