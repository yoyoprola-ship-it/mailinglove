import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import AccountApp from './account/AccountApp.jsx'
import LegalPage from './legal/LegalPage.jsx'
import { track } from './track.js'

const path = window.location.pathname
const view = path.startsWith('/admin')
  ? 'admin'
  : path.startsWith('/account')
    ? 'account'
    : path.startsWith('/terms')
      ? 'terms'
      : path.startsWith('/privacy')
        ? 'privacy'
        : 'site'

if (view === 'site') {
  track()
} else if (view === 'admin' || view === 'account') {
  // The app pages share index.html — keep them out of search results.
  document.title = view === 'admin' ? 'MailingLove admin' : 'Your MailingLove account'
  const robots =
    document.querySelector('meta[name="robots"]') ||
    document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
  robots.content = 'noindex, nofollow'
  document.querySelector('link[rel="canonical"]')?.remove()
}

const root =
  view === 'admin' ? (
    <AdminApp />
  ) : view === 'account' ? (
    <AccountApp />
  ) : view === 'terms' || view === 'privacy' ? (
    <LegalPage doc={view} />
  ) : (
    <App />
  )

createRoot(document.getElementById('root')).render(<StrictMode>{root}</StrictMode>)
