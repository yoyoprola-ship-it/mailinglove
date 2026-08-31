import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Dashboard from './Dashboard'
import Orders from './Orders'
import Settings from './Settings'
import './admin.css'

const TABS = [
  ['overview', 'Overview'],
  ['orders', 'Orders'],
  ['settings', 'Settings'],
]

export default function AdminApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [email, setEmail] = useState('')
  const [tab, setTab] = useState('overview')

  async function refresh() {
    try {
      const me = await api.get('/api/admin/me')
      setEmail(me.email)
      setState('in')
    } catch {
      setState('out')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function logout() {
    await api.post('/api/admin/logout').catch(() => {})
    setState('out')
  }

  if (state === 'loading') {
    return <div className="adm adm--center">Loading…</div>
  }
  if (state === 'out') {
    return <Login onSignedIn={refresh} />
  }

  return (
    <div className="adm">
      <header className="adm__top">
        <div className="adm__brand">MailingLove admin</div>
        <div className="adm__top-right">
          <span className="adm__who">{email}</span>
          <button className="adm__link" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="adm__tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`adm__tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="adm__main">
        {tab === 'overview' && <Dashboard />}
        {tab === 'orders' && <Orders />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
