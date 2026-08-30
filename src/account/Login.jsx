import { useState } from 'react'
import { api } from './api'

export default function Login({ onSignedIn }) {
  const [step, setStep] = useState('email') // email | code
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { challengeId } = await api.post('/api/auth/start', { email: email.trim() })
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

  return (
    <div className="acc__card">
      <h1 className="acc__title">Sign in</h1>

      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <p className="acc__muted">We'll email you a 6-digit code — no password.</p>
          <label className="acc__label">
            Email
            <input
              className="acc__input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
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
