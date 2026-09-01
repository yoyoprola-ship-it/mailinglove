import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Profile from './Profile'
import Cart from './Cart'
import Orders from './Orders'
import SupportChat from '../components/SupportChat'
import './account.css'

const params = new URLSearchParams(window.location.search)
const addParam = params.get('add') || ''
const tabParam = params.get('tab') || ''

export default function AccountApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(
    addParam || tabParam === 'cart' ? 'cart' : tabParam === 'orders' ? 'orders' : 'profile'
  )
  const [cartCount, setCartCount] = useState(0)

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
        <a className="acc__brand" href="/" aria-label="MailingLove — home">
          <img src="/logo.png" alt="MailingLove" width="631" height="200" />
        </a>
        {state === 'in' && (
          <button className="acc__link" onClick={logout}>
            Sign out
          </button>
        )}
      </header>

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
