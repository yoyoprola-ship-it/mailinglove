import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, googleSignInConfigured, loadGoogleSignIn } from '../account/googleSignIn'

// Renders Google's official "Sign in with Google" button. On success it
// hands the parent the ID token (a JWT) via `onCredential(credential)`,
// which the parent posts to /api/auth/google. Renders nothing if no
// client ID is configured.
export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const holder = useRef(null)
  const cbRef = useRef(onCredential)
  cbRef.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!googleSignInConfigured()) return
    let cancelled = false

    loadGoogleSignIn()
      .then((google) => {
        if (cancelled || !holder.current) return
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => resp?.credential && cbRef.current?.(resp.credential),
        })
        holder.current.innerHTML = ''
        google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(holder.current.offsetWidth || 320, 360),
        })
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
    }
  }, [text])

  if (!googleSignInConfigured() || failed) return null
  return <div className="gbtn" ref={holder} />
}
