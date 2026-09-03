import { useEffect, useState } from 'react'
import { api } from './api'
import Login from './Login'
import Dashboard from './Dashboard'
import Orders from './Orders'
import Gallery from './Gallery'
import CalendarTemplates from './CalendarTemplates'
import Support from './Support'
import Customers from './Customers'
import Settings from './Settings'
import './admin.css'

const TABS = [
  ['overview', 'Overview'],
  ['orders', 'Orders'],
  ['gallery', 'Postcards'],
  ['calendars', 'Calendars'],
  ['customers', 'Customers'],
  ['support', 'Support'],
  ['settings', 'Settings'],
]

export default function AdminApp() {
  const [state, setState] = useState('loading') // loading | out | in
  const [email, setEmail] = useState('')
  const [tab, setTab] = useState('overview')
  const [galleryFocus, setGalleryFocus] = useState(null)
  const [supportUnread, setSupportUnread] = useState(0)

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

  useEffect(() => {
    if (state !== 'in') return
    const poll = () =>
      api
        .get('/api/admin/support')
        .then(({ threads }) => setSupportUnread(threads.filter((t) => t.unreadForAdmin).length))
        .catch(() => {})
    poll()
    const t = setInterval(poll, 20000)
    return () => clearInterval(t)
  }, [state, tab])

  async function logout() {
    await api.post('/api/admin/logout').catch(() => {})
    setState('out')
  }

  function openGallery(postcardId) {
    setGalleryFocus(postcardId)
    setTab('gallery')
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
            {id === 'support' && supportUnread > 0 && (
              <span className="adm__tab-badge">{supportUnread}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="adm__main">
        {tab === 'overview' && <Dashboard />}
        {tab === 'orders' && <Orders onOpenGallery={openGallery} />}
        {tab === 'gallery' && (
          <Gallery focusId={galleryFocus} onFocusHandled={() => setGalleryFocus(null)} />
        )}
        {tab === 'calendars' && <CalendarTemplates />}
        {tab === 'customers' && <Customers />}
        {tab === 'support' && <Support />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
