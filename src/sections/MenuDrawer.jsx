import { useState } from 'react'
import catalog from '../data/postcards.json'

// Slide-in menu: the main pages first, then the postcard categories
// (Birthday expands to its per-recipient subcategories).
export default function MenuDrawer({
  open,
  onClose,
  onNavigate,
  onGo,
  onAccount,
  onCart,
  showPhotoPrint = false,
  showPostcardGen = false,
  showPhotoRestore = false,
}) {
  const [expanded, setExpanded] = useState('birthday')

  const pick = (type, sub = null) => {
    onNavigate(type, sub)
    onClose()
  }
  const goto = (id) => {
    onGo?.(id)
    onClose()
  }

  const links = [
    showPhotoPrint && { label: 'Print your photos', fn: () => goto('photo-print') },
    { label: 'Ready-made postcards', fn: () => goto('postcards') },
    showPostcardGen && { label: 'Generate a postcard', fn: () => goto('custom-postcard') },
    showPhotoRestore && { label: 'Restore old photos', fn: () => goto('restore') },
    { label: 'How it works', fn: () => goto('how-it-works') },
    { label: 'Your account', fn: () => (onClose(), onAccount?.()) },
    { label: 'Cart', fn: () => (onClose(), onCart?.()) },
  ].filter(Boolean)

  return (
    <>
      <div
        className={`drawer__scrim${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="drawer__head">
          <span className="drawer__title">Menu</span>
          <button className="drawer__x" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className="drawer__nav">
          <div className="drawer__links">
            {links.map((l) => (
              <button key={l.label} className="drawer__link" onClick={l.fn}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="drawer__section-h">Browse postcards</div>
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
