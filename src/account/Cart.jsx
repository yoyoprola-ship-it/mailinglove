import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import AddressFields from './AddressFields'
import catalog from '../data/postcards.json'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }
const cardById = Object.fromEntries(catalog.postcards.map((p) => [p.id, p]))

function recipientSummary(r) {
  if (!r) return null
  if (r.type === 'self') return 'To your address'
  const a = r.address || {}
  return `To ${r.name} — ${a.city}, ${a.state}`
}

const cardCount = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)
const pendingCount = (items) => items.filter((i) => !i.recipient).length

function QtyStepper({ value, onChange, disabled }) {
  return (
    <span className="acc__qty">
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1}>
        −
      </button>
      <span className="acc__qty-n">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= 20}>
        +
      </button>
    </span>
  )
}

function ItemForm({ postcard, editItem, hasAccountAddress, onDone, onCancel }) {
  const r = editItem?.recipient
  const [mode, setMode] = useState(r ? r.type : hasAccountAddress ? 'self' : 'other')
  const [name, setName] = useState(r?.type === 'other' ? r.name : '')
  const [addr, setAddr] = useState(r?.type === 'other' ? { ...emptyAddr, ...r.address } : emptyAddr)
  const [message, setMessage] = useState(editItem?.message || '')
  const [qty, setQty] = useState(editItem?.qty || 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const recipient =
        mode === 'self' ? { type: 'self' } : { type: 'other', name, address: addr }
      const body = { message, recipient, qty }
      const { items } = editItem
        ? await api.put(`/api/cart/${editItem.id}`, body)
        : await api.post('/api/cart', { ...body, postcardId: postcard.id })
      onDone(items)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acc__card acc__card--wide" onSubmit={submit}>
      <h2 className="acc__title">
        {editItem ? 'Edit' : 'Send'} “{postcard.title}”
      </h2>
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

      <div className="acc__field-inline">
        <span className="acc__label">Quantity</span>
        <QtyStepper value={qty} onChange={(v) => setQty(Math.min(20, Math.max(1, v)))} />
      </div>

      <div className="acc__actions">
        <button className="acc__btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editItem ? 'Save changes' : 'Add to cart'}
        </button>
        <button type="button" className="acc__link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="acc__error">{error}</p>}
    </form>
  )
}

export default function Cart({ initialAddId, user, onCount }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(initialAddId || '')
  const [editing, setEditing] = useState(null) // cart item being edited
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

  useEffect(() => {
    if (items) onCount?.(cardCount(items))
  }, [items, onCount])

  async function setQty(it, qty) {
    setError('')
    try {
      const { items } = await api.put(`/api/cart/${it.id}`, { qty })
      setItems(items)
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    setError('')
    try {
      const { items } = await api.delete(`/api/cart/${id}`)
      setItems(items)
    } catch (err) {
      setError(err.message)
    }
  }

  async function clearAll() {
    if (!confirm('Empty the whole cart?')) return
    setError('')
    try {
      const { items } = await api.delete('/api/cart')
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

  function closeForm(freshItems) {
    if (freshItems) setItems(freshItems)
    setAdding('')
    setEditing(null)
    history.replaceState(null, '', '/account')
  }

  if (addPostcard || editing) {
    return (
      <ItemForm
        postcard={editing ? cardById[editing.postcardId] || { title: editing.title, image: editing.image } : addPostcard}
        editItem={editing}
        hasAccountAddress={hasAccountAddress}
        onDone={closeForm}
        onCancel={() => closeForm()}
      />
    )
  }

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Your cart</h2>

      {placed && (
        <p className="acc__ok">Order placed — we'll print and mail it. Track it under Orders.</p>
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
          <p className="acc__muted acc__cart-sum">
            {items.length} design{items.length > 1 ? 's' : ''} · {cardCount(items)} card
            {cardCount(items) > 1 ? 's' : ''}
          </p>

          <ul className="acc__list">
            {items.map((it) => (
              <li className="acc__item" key={it.id}>
                <img className="acc__item-img" src={it.image} alt={it.title} />
                <div className="acc__item-body">
                  <strong>{it.title}</strong>
                  {it.recipient ? (
                    <span className="acc__muted">{recipientSummary(it.recipient)}</span>
                  ) : (
                    <button className="acc__needs" onClick={() => setEditing(it)}>
                      Set recipient &amp; message →
                    </button>
                  )}
                  {it.message && <span className="acc__msg">“{it.message}”</span>}
                  <span className="acc__item-actions">
                    <button className="acc__link" onClick={() => setEditing(it)}>
                      {it.recipient ? 'Edit' : 'Details'}
                    </button>
                    <button className="acc__link" onClick={() => remove(it.id)}>
                      Remove
                    </button>
                  </span>
                </div>
                <QtyStepper value={it.qty || 1} onChange={(v) => setQty(it, v)} />
              </li>
            ))}
          </ul>

          {pendingCount(items) > 0 && (
            <p className="acc__error">
              {pendingCount(items)} card{pendingCount(items) > 1 ? 's' : ''} still need a recipient.
            </p>
          )}

          <div className="acc__actions">
            <button
              className="acc__btn"
              onClick={placeOrder}
              disabled={busy || pendingCount(items) > 0}
            >
              {busy ? 'Placing…' : `Place order · ${cardCount(items)} card${cardCount(items) > 1 ? 's' : ''}`}
            </button>
            <a className="acc__link" href="/#postcards">
              Add more
            </a>
            <button type="button" className="acc__link" onClick={clearAll}>
              Empty cart
            </button>
          </div>
          <p className="acc__muted acc__fine">
            No charge yet — payment is coming. For now we print and mail on request.
          </p>
        </>
      )}
    </div>
  )
}
