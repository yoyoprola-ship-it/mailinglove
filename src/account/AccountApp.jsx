import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Profile from './Profile'
import './account.css'

export default function AccountApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [user, setUser] = useState(null)

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
        {state === 'in' && <Profile user={user} onSaved={setUser} />}
      </main>
    </div>
  )
}
