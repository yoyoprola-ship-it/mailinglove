import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import AddressFields from './AddressFields'
import catalog from '../data/postcards.json'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }
const cardById = Object.fromEntries(catalog.postcards.map((p) => [p.id, p]))

function recipientSummary(r) {
  if (!r) return ''
  if (r.type === 'self') return 'To your address'
  const a = r.address || {}
  return `To ${r.name} — ${a.city}, ${a.state}`
}

function AddForm({ postcard, hasAccountAddress, onAdded, onCancel }) {
  const [mode, setMode] = useState(hasAccountAddress ? 'self' : 'other')
  const [name, setName] = useState('')
  const [addr, setAddr] = useState(emptyAddr)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const recipient =
        mode === 'self' ? { type: 'self' } : { type: 'other', name, address: addr }
      const { items } = await api.post('/api/cart', {
        postcardId: postcard.id,
        message,
        recipient,
      })
      onAdded(items)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acc__card acc__card--wide" onSubmit={submit}>
      <h2 className="acc__title">Send “{postcard.title}”</h2>
      <img className="acc__pc-preview" src={postcard.image} alt={postcard.title} />

      <p className="acc__label">Send to</p>
      <label className="acc__radio">
        <input
          type="radio"
          checked={mode === 'self'}
          onChange={() => setMode('self')}
          disabled={!hasAccountAddress}
        />
        My address{!hasAccountAddress && ' (add it in Your details first)'}
      </label>
      <label className="acc__radio">
        <input type="radio" checked={mode === 'other'} onChange={() => setMode('other')} />
        Someone else
      </label>

      {mode === 'other' && (
        <div className="acc__sub">
          <label className="acc__label">
            Recipient name
            <input
              className="acc__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <AddressFields value={addr} onChange={setAddr} />
        </div>
      )}

      <label className="acc__label">
        Message on the card <span className="acc__opt">(optional, {300 - message.length} left)</span>
        <textarea
          className="acc__input acc__textarea"
          maxLength={300}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <div className="acc__actions">
        <button className="acc__btn" type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add to cart'}
        </button>
        <button type="button" className="acc__link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="acc__error">{error}</p>}
    </form>
  )
}

export default function Cart({ initialAddId, user }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(initialAddId || '')
  const [placed, setPlaced] = useState(false)
  const [busy, setBusy] = useState(false)

  const hasAccountAddress = Boolean(user?.address?.line1 && user?.name)
  const addPostcard = useMemo(() => (adding ? cardById[adding] : null), [adding])

  async function load() {
    try {
      const { items } = await api.get('/api/cart')
      setItems(items)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(id) {
    try {
      const { items } = await api.delete(`/api/cart/${id}`)
      setItems(items)
    } catch (err) {
      setError(err.message)
    }
  }

  async function placeOrder() {
    setBusy(true)
    setError('')
    try {
      await api.post('/api/orders')
      setItems([])
      setPlaced(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (addPostcard) {
    return (
      <AddForm
        postcard={addPostcard}
        hasAccountAddress={hasAccountAddress}
        onAdded={(items) => {
          setItems(items)
          setAdding('')
          history.replaceState(null, '', '/account')
        }}
        onCancel={() => {
          setAdding('')
          history.replaceState(null, '', '/account')
        }}
      />
    )
  }

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Your cart</h2>

      {placed && (
        <p className="acc__ok">
          Order placed — we'll print and mail it. Track it under Orders.
        </p>
      )}

      {!items && !error && <p className="acc__muted">Loading…</p>}
      {error && <p className="acc__error">{error}</p>}

      {items && items.length === 0 && !placed && (
        <p className="acc__muted">
          Nothing here yet. <a href="/#postcards">Browse postcards</a>.
        </p>
      )}

      {items && items.length > 0 && (
        <>
          <ul className="acc__list">
            {items.map((it) => (
              <li className="acc__item" key={it.id}>
                <img className="acc__item-img" src={it.image} alt={it.title} />
                <div className="acc__item-body">
                  <strong>{it.title}</strong>
                  <span className="acc__muted">{recipientSummary(it.recipient)}</span>
                  {it.message && <span className="acc__msg">“{it.message}”</span>}
                </div>
                <button className="acc__link" onClick={() => remove(it.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="acc__actions">
            <button className="acc__btn" onClick={placeOrder} disabled={busy}>
              {busy ? 'Placing…' : `Place order (${items.length})`}
            </button>
            <a className="acc__link" href="/#postcards">
              Add more
            </a>
          </div>
          <p className="acc__muted acc__fine">
            No charge yet — payment is coming. For now we print and mail on request.
          </p>
        </>
      )}
    </div>
  )
}
