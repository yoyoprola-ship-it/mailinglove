// Meta (Facebook) Pixel. The pixel ID is a Vite build-time env var
// (VITE_META_PIXEL_ID) — a public identifier, not a secret. With no ID
// the loader and every track() call are no-ops, so ads tracking stays
// off until it's configured.

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || ''

export function metaPixelConfigured() {
  return Boolean(PIXEL_ID)
}

// Standard Meta base snippet, guarded so it only runs once and only when
// an ID is set. Fires the initial PageView.
export function initMetaPixel() {
  if (!PIXEL_ID || window.fbq) return
  /* eslint-disable */
  ;(function (f, b, e, v, n, t, s) {
    if (f.fbq) return
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = !0
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = !0
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')
}

// Fire a standard event. `params` is the Meta custom-data object
// (value, currency, content_ids, …); `eventID` (optional) is for
// deduplication against a future server-side Conversions API event.
export function mpTrack(event, params, eventID) {
  try {
    if (!window.fbq) return
    if (eventID) window.fbq('track', event, params || {}, { eventID })
    else window.fbq('track', event, params || {})
  } catch {
    /* tracking must never break the page */
  }
}
