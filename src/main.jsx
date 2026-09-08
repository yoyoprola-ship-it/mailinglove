import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import AccountApp from './account/AccountApp.jsx'
import LegalPage from './legal/LegalPage.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { track } from './track.js'

// In-browser page translators (Chrome/Google Translate, Samsung, etc.)
// swap text nodes out from under React — usually wrapping them in <font>
// tags. React then throws NotFoundError from removeChild/insertBefore on
// the next update and, with no boundary, unmounts the whole tree (blank
// page until reload). Making these two DOM calls no-op when the node
// isn't actually a child lets React recover on the next render while the
// translation keeps working. Widely used workaround for this exact bug.
if (typeof Node === 'function' && Node.prototype) {
  const realRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child
    return realRemoveChild.apply(this, arguments)
  }
  const realInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) return newNode
    return realInsertBefore.apply(this, arguments)
  }
}

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>{root}</ErrorBoundary>
  </StrictMode>
)
