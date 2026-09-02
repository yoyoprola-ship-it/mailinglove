import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import catalog from '../data/postcards.json'

// Slide-in menu: the main pages first, then the postcard categories
// (each type expands to its subcategories).

const TYPE_ICON = { birthday: 'cake', love: 'heart', family: 'family', christmas: 'snowflake' }

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

  // Lock the page behind the drawer and close on Escape while it's open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const pick = (type, sub = null) => {
    onNavigate(type, sub)
    onClose()
  }
  const goto = (id) => {
    onGo?.(id)
    onClose()
  }

  const pageLinks = [
    showPhotoPrint && { label: 'Print your photos', icon: 'image', fn: () => goto('photo-print') },
    { label: 'Ready-made postcards', icon: 'mail', fn: () => goto('postcards') },
    showPostcardGen && {
      label: 'Generate a postcard',
      icon: 'sparkles',
      fn: () => goto('custom-postcard'),
    },
    showPhotoRestore && {
      label: 'Restore old photos',
      icon: 'upload',
      fn: () => goto('restore'),
    },
    { label: 'How it works', icon: 'info', fn: () => goto('how-it-works') },
  ].filter(Boolean)

  const youLinks = [
    { label: 'Your account', icon: 'user', fn: () => (onClose(), onAccount?.()) },
    { label: 'Cart', icon: 'cart', fn: () => (onClose(), onCart?.()) },
  ]

  const Row = ({ l }) => (
    <button className="drawer__link" onClick={l.fn}>
      <span className="drawer__ico">
        <Icon name={l.icon} size={18} />
      </span>
      <span className="drawer__link-t">{l.label}</span>
      <span className="drawer__link-go">
        <Icon name="arrow" size={15} />
      </span>
    </button>
  )

  return (
    <>
      <div
        className={`drawer__scrim${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`drawer${open ? ' is-open' : ''}`} aria-hidden={!open} aria-label="Menu">
        <div className="drawer__head">
          <img className="drawer__logo" src="/logo.png" alt="MailingLove" />
          <button className="drawer__x" onClick={onClose} aria-label="Close menu">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="drawer__nav">
          <div className="drawer__links">
            {pageLinks.map((l) => (
              <Row key={l.label} l={l} />
            ))}
          </div>

          <div className="drawer__section-h">Browse postcards</div>
          <div className="drawer__cats">
            {catalog.types.map((t) => {
              const hasSubs = t.subcategories.length > 0
              const isOpen = hasSubs && expanded === t.id
              return (
                <div key={t.id} className={`drawer__cat${isOpen ? ' is-open' : ''}`}>
                  <button
                    className="drawer__type"
                    onClick={() => (hasSubs ? setExpanded(isOpen ? '' : t.id) : pick(t.id))}
                  >
                    <span className="drawer__ico">
                      <Icon name={TYPE_ICON[t.id] || 'mail'} size={18} />
                    </span>
                    <span className="drawer__link-t">{t.label}</span>
                    {hasSubs ? (
                      <span className="drawer__chev" aria-hidden="true">
                        <Icon name="arrow" size={15} />
                      </span>
                    ) : (
                      <span className="drawer__link-go">
                        <Icon name="arrow" size={15} />
                      </span>
                    )}
                  </button>

                  {isOpen && (
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
              )
            })}
          </div>

          <div className="drawer__section-h">You</div>
          <div className="drawer__links">
            {youLinks.map((l) => (
              <Row key={l.label} l={l} />
            ))}
          </div>
        </nav>

        <div className="drawer__foot">Printed &amp; mailed with love · mailinglove.com</div>
      </aside>
    </>
  )
}
