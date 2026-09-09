// Lightweight first-party visit tracking. One beacon per page load; a random
// per-browser id lets the server count uniques without cookies.
export function track() {
  try {
    let id = localStorage.getItem('ml_vid')
    if (!id) {
      id = (crypto.randomUUID?.() || String(Math.random()).slice(2)) + ''
      localStorage.setItem('ml_vid', id)
    }
    const body = JSON.stringify({
      path: location.pathname,
      ref: document.referrer || '',
      visitorId: id,
    })
    // keepalive so it still sends if the page is closing
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // tracking must never break the page
  }
}

// First-party behavioural event for the admin dashboard funnel:
//   trackEvent('add_to_cart', { valueCents: 299 })
// Known names only (server-side allowlist): add_to_cart, initiate_checkout,
// purchase, sign_in.
export function trackEvent(name, { valueCents } = {}) {
  try {
    const body = JSON.stringify({
      event: name,
      valueCents: Number.isFinite(valueCents) ? Math.round(valueCents) : undefined,
      path: location.pathname,
      visitorId: localStorage.getItem('ml_vid') || '',
    })
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // tracking must never break the page
  }
}
