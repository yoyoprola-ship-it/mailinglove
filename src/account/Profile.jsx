import { useState } from 'react'
import { api } from './api'
import AddressFields from './AddressFields'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }

export default function Profile({ user, onSaved, onDeleted }) {
  const [name, setName] = useState(user.name || '')
  const [addr, setAddr] = useState({ ...emptyAddr, ...(user.address || {}) })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState('')

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

  async function deleteAccount() {
    setDelBusy(true)
    setDelError('')
    try {
      await api.delete('/api/me')
      onDeleted?.()
    } catch (err) {
      setDelError(err.message)
      setDelBusy(false)
    }
  }

  return (
    <>
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

      <div className="acc__card acc__card--wide acc__danger">
        <h2 className="acc__title">Delete account</h2>
        <p className="acc__muted">
          Permanently removes your profile, saved address, cart and support
          messages. Past orders are kept as records. This can't be undone.
        </p>

        {!delOpen ? (
          <button
            type="button"
            className="acc__btn acc__btn--danger"
            onClick={() => {
              setDelOpen(true)
              setDelText('')
              setDelError('')
            }}
          >
            Delete my account
          </button>
        ) : (
          <>
            <label className="acc__label">
              Type <strong>DELETE</strong> to confirm
              <input
                className="acc__input"
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                autoFocus
              />
            </label>
            <div className="acc__actions">
              <button
                type="button"
                className="acc__btn acc__btn--danger"
                disabled={delText.trim() !== 'DELETE' || delBusy}
                onClick={deleteAccount}
              >
                {delBusy ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                type="button"
                className="acc__link"
                onClick={() => setDelOpen(false)}
                disabled={delBusy}
              >
                Cancel
              </button>
            </div>
            {delError && <p className="acc__error">{delError}</p>}
          </>
        )}
      </div>
    </>
  )
}
