import { useState } from 'react'
import Icon from '../components/Icon'
import MenuDrawer from './MenuDrawer'

export default function Nav({
  onNavigate,
  onAccount,
  onCart,
  onGo,
  cartCount = 0,
  showPhotoPrint = false,
  showPostcardGen = false,
  showPhotoRestore = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="site-nav">
      <div className="section-inner site-nav__inner">
        <div className="site-nav__left">
          <button
            className="site-nav__burger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
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
          <button
            className="site-nav__cart"
            type="button"
            onClick={onCart}
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          >
            <Icon name="cart" size={20} />
            {cartCount > 0 && <span className="site-nav__cart-badge">{cartCount}</span>}
          </button>
        </span>
      </div>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
        onGo={onGo}
        onAccount={onAccount}
        onCart={onCart}
        showPhotoPrint={showPhotoPrint}
        showPostcardGen={showPostcardGen}
        showPhotoRestore={showPhotoRestore}
      />
    </header>
  )
}
