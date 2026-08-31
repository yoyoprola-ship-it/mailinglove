import { useState } from 'react'
import { api } from './api'
import AddressFields from './AddressFields'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }

export default function Profile({ user, onSaved }) {
  const [name, setName] = useState(user.name || '')
  const [addr, setAddr] = useState({ ...emptyAddr, ...(user.address || {}) })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

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
      <h2 className="acc__title">Your details</h2>
      <p className="acc__muted">
        Signed in as {user.email}. We use this as your billing/contact address and
        for postcards you send to yourself.
      </p>

      <label className="acc__label">
        Full name
        <input
          className="acc__input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setMsg('')
          }}
          required
        />
      </label>

      <AddressFields
        value={addr}
        onChange={(v) => {
          setAddr(v)
          setMsg('')
        }}
      />

      <button className="acc__btn" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save details'}
      </button>
      {msg && <p className="acc__ok">{msg}</p>}
      {error && <p className="acc__error">{error}</p>}
    </form>
  )
}
