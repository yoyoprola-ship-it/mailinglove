import { useEffect, useState } from 'react'
import GoogleButton from './GoogleButton'
import ConsentGate from './ConsentGate'
import { googleSignInConfigured } from '../account/googleSignIn'
import { trackEvent } from '../track'

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// Modal sign-in / sign-up: Google, or email -> 6-digit code, no password.
// `context` is { mode: 'account' } or { mode: 'add', postcard }. Terms
// consent is collected in a small popup the first time a method is used.
export default function AuthModal({ context, onClose, onSignedIn }) {
  const [step, setStep] = useState('email') // email | code | done
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [consented, setConsented] = useState(false)
  const [gate, setGate] = useState(null) // null | 'email' | 'google'
  const [pendingCredential, setPendingCredential] = useState(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const isAdd = context?.mode === 'add'

  function afterSignIn(user) {
    trackEvent('sign_in')
    onSignedIn(user)
    if (!isAdd) setStep('done')
  }

  async function runGoogle(credential) {
    setBusy(true)
    setError('')
    try {
      const { user } = await post('/api/auth/google', { credential, acceptedTerms: true })
      afterSignIn(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function runSendCode() {
    setBusy(true)
    setError('')
    try {
      const { challengeId } = await post('/api/auth/start', {
        email: email.trim(),
        acceptedTerms: true,
      })
      setChallengeId(challengeId)
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function googleSignIn(credential) {
    if (consented) return runGoogle(credential)
    setPendingCredential(credential)
    setGate('google')
  }

  function sendCode(e) {
    e.preventDefault()
    if (consented) return runSendCode()
    setGate('email')
  }

  async function acceptConsent() {
    const which = gate
    setConsented(true)
    if (which === 'google') await runGoogle(pendingCredential)
    else await runSendCode()
    setGate(null)
    setPendingCredential(null)
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/auth/verify', { challengeId, code: code.trim() })
      afterSignIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="authm__box" onClick={(e) => e.stopPropagation()}>
        <button className="authm__x" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === 'email' && (
          <form onSubmit={sendCode}>
            <h2 className="authm__title">Sign in or create your account</h2>
            <p className="authm__sub">
              {isAdd
                ? `Sign in to add “${context.postcard.title}” to your cart.`
                : 'No password — continue with Google or get a code by email.'}
            </p>

            {googleSignInConfigured() && (
              <>
                <div className="authm__google">
                  <GoogleButton onCredential={googleSignIn} />
                </div>
                <div className="authm__or">
                  <span>or</span>
                </div>
              </>
            )}

            <input
              className="authm__input"
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn--primary authm__go" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify}>
            <h2 className="authm__title">Check your email</h2>
            <p className="authm__sub">
              We sent a code to <strong>{email}</strong>.
            </p>
            <input
              className="authm__input authm__input--code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn btn--primary authm__go" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="authm__link"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
              }}
            >
              Use a different email
            </button>
          </form>
        )}

        {step === 'done' && (
          <div>
            <h2 className="authm__title">You're in ✓</h2>
            <p className="authm__sub">
              {isAdd
                ? `Add your message and who “${context.postcard.title}” is going to.`
                : 'Your account is ready.'}
            </p>
            <a
              className="btn btn--primary authm__go"
              href={isAdd ? `/account?add=${context.postcard.id}` : '/account'}
            >
              {isAdd ? 'Continue' : 'Open my account'}
            </a>
            <button type="button" className="authm__link" onClick={onClose}>
              Keep browsing
            </button>
          </div>
        )}

        {error && <p className="authm__error">{error}</p>}
      </div>

      {gate && (
        <ConsentGate
          busy={busy}
          onAccept={acceptConsent}
          onClose={() => {
            setGate(null)
            setPendingCredential(null)
          }}
        />
      )}
    </div>
  )
}
