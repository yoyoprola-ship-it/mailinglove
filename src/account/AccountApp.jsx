import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Profile from './Profile'
import Cart from './Cart'
import Orders from './Orders'
import SupportChat from '../components/SupportChat'
import MenuDrawer from '../sections/MenuDrawer'
import { mpTrack } from '../metaPixel'
import { trackEvent } from '../track'
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
  const [flags, setFlags] = useState({
    photoPrint: true,
    postcardGen: true,
    photoRestore: true,
    calendar: false,
  })

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
          calendar: Boolean(c.calendarEnabled),
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

  // Back from a successful payment (Stripe or PayPal both land on
  // /account with a marker). Fire the ads Purchase event once per order,
  // then strip the marker so a refresh doesn't look like a new sale.
  useEffect(() => {
    if (state !== 'in') return
    const q = new URLSearchParams(window.location.search)
    if (!q.get('paid') && !q.get('stripe_session')) return

    api
      .get('/api/orders')
      .then(({ orders }) => {
        if (!Array.isArray(orders)) return
        const paid = orders
          .filter((o) => o.status && o.status !== 'awaiting_payment')
          .sort((a, b) => (b.paidAt || b.createdAt || 0) - (a.paidAt || a.createdAt || 0))[0]
        if (!paid) return
        const key = `ml_fb_purchase_${paid.id}`
        try {
          if (localStorage.getItem(key)) return
          localStorage.setItem(key, '1')
        } catch {
          /* private mode — fine, may fire twice at worst */
        }
        mpTrack(
          'Purchase',
          {
            value: (paid.amountCents || 0) / 100,
            currency: (paid.currency || 'usd').toUpperCase(),
            num_items:
              paid.cardCount || (paid.items || []).reduce((n, i) => n + (i.qty || 1), 0),
            content_type: 'product',
            content_ids: (paid.items || [])
              .map((i) => i.postcardId || i.photoId)
              .filter(Boolean),
          },
          `purchase_${paid.id}`
        )
        trackEvent('purchase', { valueCents: paid.amountCents || 0 })
      })
      .catch(() => {})

    const u = new URL(window.location.href)
    u.searchParams.delete('paid')
    u.searchParams.delete('stripe_session')
    window.history.replaceState(null, '', u.pathname + u.search)
  }, [state])

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
        showCalendar={flags.calendar}
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

            {tab === 'profile' && (
              <Profile
                user={user}
                onSaved={setUser}
                onDeleted={() => {
                  setUser(null)
                  setState('out')
                }}
              />
            )}
            {tab === 'cart' && (
              <Cart user={user} onCount={setCartCount} onUser={setUser} />
            )}
            {tab === 'orders' && <Orders />}
          </>
        )}
      </main>

      <SupportChat signedIn={state === 'in'} onRequireAuth={() => setState('out')} />
    </div>
  )
}
