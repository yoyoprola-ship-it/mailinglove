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
