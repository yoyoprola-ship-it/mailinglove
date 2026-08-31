import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Profile from './Profile'
import Cart from './Cart'
import Orders from './Orders'
import './account.css'

const addParam = new URLSearchParams(window.location.search).get('add') || ''

export default function AccountApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState(addParam ? 'cart' : 'profile')

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
        <a className="acc__brand" href="/">
          MailingLove
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
                  {t === 'profile' ? 'Your details' : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </nav>

            {tab === 'profile' && <Profile user={user} onSaved={setUser} />}
            {tab === 'cart' && <Cart initialAddId={addParam} user={user} />}
            {tab === 'orders' && <Orders />}
          </>
        )}
      </main>
    </div>
  )
}
