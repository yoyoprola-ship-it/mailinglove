import { useState } from 'react'
import Icon from '../components/Icon'
import MenuDrawer from './MenuDrawer'

export default function Nav({ onNavigate, onAccount }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-nav">
      <div className="section-inner site-nav__inner">
        <div className="site-nav__left">
          <button
            className="site-nav__burger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open postcard menu"
          >
            <span />
            <span />
            <span />
          </button>
          <a className="brand" href="#top">
            <span className="brand__mark">
              <Icon name="heart" size={16} />
            </span>
            <span>MailingLove</span>
          </a>
        </div>
        <span className="site-nav__actions">
          <button className="site-nav__link" type="button" onClick={onAccount}>
            Account
          </button>
          <a className="btn btn--primary btn--sm" href="#waitlist">
            Join the waitlist
          </a>
        </span>
      </div>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
      />
    </header>
  )
}
