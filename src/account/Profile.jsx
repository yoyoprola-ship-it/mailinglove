import { useState } from 'react'
import { api } from './api'
import { US_STATES } from './states'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }

export default function Profile({ user, onSaved }) {
  const [name, setName] = useState(user.name || '')
  const [addr, setAddr] = useState({ ...emptyAddr, ...(user.address || {}) })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  function setField(k, v) {
    setAddr((a) => ({ ...a, [k]: v }))
    setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const { user: updated } = await api.put('/api/me', { name, address: addr })
      onSaved(updated)
      setMsg('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acc__card acc__card--wide" onSubmit={save}>
      <h1 className="acc__title">Your details</h1>
      <p className="acc__muted">
        Signed in as {user.email}. This is where we'll mail your postcards.
      </p>

      <label className="acc__label">
        Full name
        <input className="acc__input" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className="acc__label">
        Street address
        <input
          className="acc__input"
          value={addr.line1}
          onChange={(e) => setField('line1', e.target.value)}
          placeholder="123 Main St"
          required
        />
      </label>

      <label className="acc__label">
        Apt / suite / unit <span className="acc__opt">(optional)</span>
        <input
          className="acc__input"
          value={addr.line2}
          onChange={(e) => setField('line2', e.target.value)}
        />
      </label>

      <div className="acc__row">
        <label className="acc__label acc__label--grow">
          City
          <input
            className="acc__input"
            value={addr.city}
            onChange={(e) => setField('city', e.target.value)}
            required
          />
        </label>
        <label className="acc__label">
          State
          <select
            className="acc__input"
            value={addr.state}
            onChange={(e) => setField('state', e.target.value)}
            required
          >
            <option value="">—</option>
            {US_STATES.map(([code, label]) => (
              <option key={code} value={code}>
                {code} — {label}
              </option>
            ))}
          </select>
        </label>
        <label className="acc__label">
          ZIP
          <input
            className="acc__input acc__input--zip"
            value={addr.zip}
            onChange={(e) => setField('zip', e.target.value)}
            placeholder="10001"
            inputMode="numeric"
            required
          />
        </label>
      </div>

      <button className="acc__btn" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save details'}
      </button>
      {msg && <p className="acc__ok">{msg}</p>}
      {error && <p className="acc__error">{error}</p>}
    </form>
  )
}
