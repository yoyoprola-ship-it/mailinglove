// Lazy-loads the Google Maps JS API (Places library) once, on demand — only
// pages that actually show an address form pay for it. The API key is a
// Vite build-time env var (VITE_GOOGLE_MAPS_API_KEY); it's a public,
// referrer-restricted key by design, not a server secret.

let loadPromise = null

export function googleMapsConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
}

export function loadGoogleMaps() {
  if (loadPromise) return loadPromise

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) return Promise.reject(new Error('Google Maps is not configured.'))

  if (window.google?.maps?.places) return Promise.resolve(window.google)

  loadPromise = new Promise((resolve, reject) => {
    window.__mlMapsReady = () => resolve(window.google)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&callback=__mlMapsReady`
    script.async = true
    script.onerror = () => reject(new Error('Could not load Google Maps.'))
    document.head.appendChild(script)
  })

  return loadPromise
}

// Split a Places `address_components` array into our address shape.
// `line1` = street number + route; state/zip use the 2-letter / 5-digit
// short forms our forms already expect.
export function placeToAddress(place) {
  const comps = place?.address_components || []
  const part = (type) => comps.find((c) => c.types.includes(type))
  const streetNumber = part('street_number')?.long_name || ''
  const route = part('route')?.long_name || ''
  const city =
    part('locality')?.long_name ||
    part('sublocality')?.long_name ||
    part('postal_town')?.long_name ||
    ''
  const state = part('administrative_area_level_1')?.short_name || ''
  const zip = part('postal_code')?.long_name || ''
  return {
    line1: [streetNumber, route].filter(Boolean).join(' '),
    city,
    state,
    zip,
  }
}
