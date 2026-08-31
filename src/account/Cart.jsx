import { useEffect, useState } from 'react'
import { api } from './api'
import AddressFields from './AddressFields'
import Checkout from './Checkout'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }
const cardCount = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)

function recipientSummary(r) {
  if (!r) return null
  if (r.type === 'self') return 'To your address'
  const a = r.address || {}
  return `To ${r.name} — ${a.line1}, ${a.city}, ${a.state} ${a.zip}`
}

function QtyStepper({ value, onChange, min = 1 }) {
  return (
    <span className="acc__qty">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </button>
      <span className="acc__qty-n">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= 50}>
        +
      </button>
    </span>
  )
}

function ShippingForm({ shipping, hasAccountAddress, onDone, onCancel }) {
  const r = shipping?.recipient
  const [mode, setMode] = useState(r ? r.type : hasAccountAddress ? 'self' : 'other')
  const [name, setName] = useState(r?.type === 'other' ? r.name : '')
  const [addr, setAddr] = useState(r?.type === 'other' ? { ...emptyAddr, ...r.address } : emptyAddr)
  const [message, setMessage] = useState(shipping?.message || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const recipient =
        mode === 'self' ? { type: 'self' } : { type: 'other', name, address: addr }
      const res = await api.put('/api/cart/shipping', { recipient, message })
      onDone(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acc__card acc__card--wide" onSubmit={submit}>
      <h2 className="acc__title">Recipient &amp; message</h2>
      <p className="acc__muted">Every card in this cart is sent to this person.</p>

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
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="acc__link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="acc__error">{error}</p>}
    </form>
  )
}

export default function Cart({ user, onCount }) {
  const [items, setItems] = useState(null)
  const [shipping, setShipping] = useState({ recipient: null, message: '' })
  const [error, setError] = useState('')
  const [editShip, setEditShip] = useState(false)
  const [checkoutOrder, setCheckoutOrder] = useState(null)
  const [busy, setBusy] = useState(false)

  const hasAccountAddress = Boolean(user?.address?.line1 && user?.name)

  async function load() {
    try {
      const d = await api.get('/api/cart')
      setItems(d.items)
      setShipping({ recipient: d.recipient || null, message: d.message || '' })
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
      const { items } = qty <= 0
        ? await api.delete(`/api/cart/${it.id}`)
        : await api.put(`/api/cart/${it.id}`, { qty })
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

  async function startCheckout() {
    setBusy(true)
    setError('')
    try {
      const { order } = await api.post('/api/checkout')
      setCheckoutOrder(order)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (checkoutOrder) {
    return <Checkout order={checkoutOrder} onBack={() => setCheckoutOrder(null)} />
  }

  if (editShip) {
    return (
      <ShippingForm
        shipping={shipping}
        hasAccountAddress={hasAccountAddress}
        onDone={(res) => {
          setShipping({ recipient: res.recipient, message: res.message })
          setEditShip(false)
        }}
        onCancel={() => setEditShip(false)}
      />
    )
  }

  const count = items ? cardCount(items) : 0

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Your cart</h2>

      {!items && !error && <p className="acc__muted">Loading…</p>}
      {error && <p className="acc__error">{error}</p>}

      {items && items.length === 0 && (
        <p className="acc__muted">
          Nothing here yet. <a href="/#postcards">Browse postcards</a>.
        </p>
      )}

      {items && items.length > 0 && (
        <>
          <p className="acc__muted acc__cart-sum">
            {items.length} design{items.length > 1 ? 's' : ''} · {count} card{count > 1 ? 's' : ''}
          </p>

          <ul className="acc__list">
            {items.map((it) => (
              <li className="acc__item" key={it.id}>
                <img className="acc__item-img" src={it.image} alt={it.title} />
                <div className="acc__item-body">
                  <strong>{it.title}</strong>
                  <button className="acc__link" onClick={() => remove(it.id)}>
                    Remove
                  </button>
                </div>
                <QtyStepper value={it.qty || 1} min={0} onChange={(v) => setQty(it, v)} />
              </li>
            ))}
          </ul>

          <div className="acc__ship">
            <div>
              <span className="acc__label">Recipient &amp; message</span>
              {shipping.recipient ? (
                <>
                  <p className="acc__muted">{recipientSummary(shipping.recipient)}</p>
                  {shipping.message && <p className="acc__msg">“{shipping.message}”</p>}
                </>
              ) : (
                <p className="acc__muted">Not set yet — every card ships to one person.</p>
              )}
            </div>
            <button className="acc__btn acc__btn--soft" onClick={() => setEditShip(true)}>
              {shipping.recipient ? 'Change' : 'Set recipient & message'}
            </button>
          </div>

          <div className="acc__actions">
            <button
              className="acc__btn"
              onClick={startCheckout}
              disabled={busy || !shipping.recipient}
            >
              {busy ? 'Loading…' : `Checkout · ${count} card${count > 1 ? 's' : ''}`}
            </button>
            <a className="acc__link" href="/#postcards">
              Add more
            </a>
            <button type="button" className="acc__link" onClick={clearAll}>
              Empty cart
            </button>
          </div>
          {!shipping.recipient && (
            <p className="acc__error">Set the recipient before checkout.</p>
          )}
          <p className="acc__muted acc__fine">
            We print and mail every card in this order to the recipient above.
          </p>
        </>
      )}
    </div>
  )
}
