import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Profile from './Profile'
import Cart from './Cart'
import Orders from './Orders'
import SupportChat from '../components/SupportChat'
import MenuDrawer from '../sections/MenuDrawer'
import './account.css'

const params = new URLSearchParams(window.location.search)
const addParam = params.get('add') || ''
const tabParam = params.get('tab') || ''

// From the account pages the menu links jump back to the storefront.
const goHome = (id) => {
  window.location.href = `/#${id}`
}
const goCategory = (type, sub) => {
  const q = new URLSearchParams({ type })
  if (sub) q.set('sub', sub)
  window.location.href = `/?${q.toString()}#postcards`
}

export default function AccountApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(
    addParam || tabParam === 'cart' ? 'cart' : tabParam === 'orders' ? 'orders' : 'profile'
  )
  const [cartCount, setCartCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [flags, setFlags] = useState({ photoPrint: true, postcardGen: true, photoRestore: true })

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((c) =>
        setFlags({
          photoPrint:
            Boolean(c.photoPrintEnabled) &&
            (c.photoPrintFormats10?.length || 0) + (c.photoPrintFormatsCatalog?.length || 0) > 0,
          postcardGen: Boolean(c.postcardDesignEnabled),
          photoRestore: Boolean(c.photoRedesignEnabled),
        })
      )
      .catch(() => {})
  }, [])

  async function refresh() {
    try {
      const { user } = await api.get('/api/me')
      setUser(user)
      setState('in')
    } catch {
      setState('out')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {})
    setUser(null)
    setState('out')
  }

  return (
    <div className="acc">
      <header className="acc__top">
        <div className="acc__top-left">
          <button
            className="site-nav__burger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
          <a className="acc__brand" href="/" aria-label="MailingLove — home">
            <img src="/logo.png" alt="MailingLove" width="631" height="200" />
          </a>
        </div>
        {state === 'in' && (
          <button className="acc__link" onClick={logout}>
            Sign out
          </button>
        )}
      </header>

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={goCategory}
        onGo={goHome}
        onHome={() => {
          window.location.href = '/'
        }}
        onAccount={() => {
          setMenuOpen(false)
          setTab('profile')
        }}
        onCart={() => {
          setMenuOpen(false)
          setTab('cart')
        }}
        onOrders={() => {
          setMenuOpen(false)
          setTab('orders')
        }}
        cartCount={cartCount}
        showPhotoPrint={flags.photoPrint}
        showPostcardGen={flags.postcardGen}
        showPhotoRestore={flags.photoRestore}
      />

      <main className="acc__main">
        {state === 'loading' && <p className="acc__muted">Loading…</p>}
        {state === 'out' && <Login onSignedIn={refresh} />}
        {state === 'in' && (
          <>
            <nav className="acc__tabs">
              {['profile', 'cart', 'orders'].map((t) => (
                <button
                  key={t}
                  className={`acc__tab${tab === t ? ' is-active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'profile'
                    ? 'Your details'
                    : t === 'cart'
                      ? `Cart${cartCount ? ` (${cartCount})` : ''}`
                      : 'Orders'}
                </button>
              ))}
            </nav>

            {tab === 'profile' && <Profile user={user} onSaved={setUser} />}
            {tab === 'cart' && (
              <Cart user={user} onCount={setCartCount} />
            )}
            {tab === 'orders' && <Orders />}
          </>
        )}
      </main>

      <SupportChat signedIn={state === 'in'} onRequireAuth={() => setState('out')} />
    </div>
  )
}
