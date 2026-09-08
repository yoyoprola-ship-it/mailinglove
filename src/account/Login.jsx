import { useState } from 'react'
import { api } from './api'
import GoogleButton from '../components/GoogleButton'
import { googleSignInConfigured } from './googleSignIn'

export default function Login({ onSignedIn }) {
  const [step, setStep] = useState('email') // email | code
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e) {
    e.preventDefault()
    if (!agree) {
      setError('Please read and accept the Terms & Conditions and Privacy Policy first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { challengeId } = await api.post('/api/auth/start', {
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

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/auth/verify', { challengeId, code: code.trim() })
      onSignedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function googleSignIn(credential) {
    if (!agree) {
      setError('Please read and accept the Terms & Conditions and Privacy Policy first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post('/api/auth/google', { credential, acceptedTerms: true })
      onSignedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acc__card">
      <h1 className="acc__title">Sign in</h1>

      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <p className="acc__muted">No password — use Google or a 6-digit code by email.</p>

          <label className="acc__check">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked)
                if (e.target.checked) setError('')
              }}
            />
            <span>
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms &amp; Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {googleSignInConfigured() && (
            <>
              <div className="acc__google">
                <GoogleButton onCredential={googleSignIn} />
              </div>
              <div className="acc__or"><span>or</span></div>
            </>
          )}

          <label className="acc__label">
            Email
            <input
              className="acc__input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="acc__btn" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="acc__muted">
            Enter the code we sent to <strong>{email}</strong>.
          </p>
          <label className="acc__label">
            Code
            <input
              className="acc__input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </label>
          <button className="acc__btn" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="acc__link"
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

      {error && <p className="acc__error">{error}</p>}
    </div>
  )
}
