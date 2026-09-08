// Loads Google Identity Services once, on demand. The OAuth Web client ID
// is a Vite build-time env var (VITE_GOOGLE_OAUTH_CLIENT_ID) — it's a
// public identifier, not a secret. When it's unset the "Sign in with
// Google" button simply doesn't render.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''

let loadPromise = null

export function googleSignInConfigured() {
  return Boolean(GOOGLE_CLIENT_ID)
}

export function loadGoogleSignIn() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google)
        : reject(new Error('Google sign-in failed to load.'))
    script.onerror = () => reject(new Error('Google sign-in failed to load.'))
    document.head.appendChild(script)
  })

  return loadPromise
}
