import { useState } from 'react'
import { api } from './api'

export default function Login({ onSignedIn }) {
  const [step, setStep] = useState('start') // start | codes
  const [challengeId, setChallengeId] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(null)

  async function sendCodes() {
    setBusy(true)
    setError('')
    setMissing(null)
    try {
      const { challengeId } = await api.post('/api/admin/login/start')
      setChallengeId(challengeId)
      setStep('codes')
    } catch (err) {
      setError(err.message)
      if (err.data?.missing) setMissing(err.data.missing)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/admin/login/verify', {
        challengeId,
        emailCode: emailCode.trim(),
        smsCode: smsCode.trim(),
      })
      onSignedIn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm adm--center">
      <div className="adm__card">
        <h1 className="adm__title">MailingLove admin</h1>

        {step === 'start' ? (
          <>
            <p className="adm__muted">
              We'll text a code to your phone and email a second code. You need both.
            </p>
            <button className="adm__btn" onClick={sendCodes} disabled={busy}>
              {busy ? 'Sending…' : 'Send me the codes'}
            </button>
          </>
        ) : (
          <form onSubmit={verify}>
            <label className="adm__label">
              Code from SMS
              <input
                className="adm__input"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
                autoFocus
              />
            </label>
            <label className="adm__label">
              Code from email
              <input
                className="adm__input"
                inputMode="numeric"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
              />
            </label>
            <button className="adm__btn" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="adm__link"
              onClick={() => {
                setStep('start')
                setEmailCode('')
                setSmsCode('')
                setError('')
              }}
            >
              Start over
            </button>
          </form>
        )}

        {error && <p className="adm__error">{error}</p>}
        {missing && (
          <ul className="adm__missing">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
