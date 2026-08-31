import { useEffect, useState } from 'react'
import { api } from './api'
import Icon from '../components/Icon'
import AddressFields from './AddressFields'
import Checkout from './Checkout'

const emptyAddr = { line1: '', line2: '', city: '', state: '', zip: '' }
const cardCount = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)
const money = (cents, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format((cents || 0) / 100)

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

function CartLine({ item, priceCents, currency, onQty, onRemove, onSaveNote }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(item.note || '')

  function done() {
    if (draft.trim() !== (item.note || '')) onSaveNote(item, draft.trim())
    setOpen(false)
  }

  return (
    <li className="acc__item acc__item--note">
      <img className="acc__item-img" src={item.image} alt={item.title} />
      <div className="acc__item-body">
        <div className="acc__item-head">
          <strong>{item.title}</strong>
          <span className="acc__item-controls">
            <button
              type="button"
              className="acc__trash"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.title}`}
            >
              <Icon name="trash" size={16} />
            </button>
            <QtyStepper value={item.qty || 1} min={0} onChange={(v) => onQty(item, v)} />
          </span>
        </div>

        {priceCents > 0 && (
          <span className="acc__muted acc__line-total">
            {money((item.qty || 1) * priceCents, currency)}
          </span>
        )}

        {open ? (
          <div className="acc__note-edit">
            <textarea
              className="acc__input acc__textarea"
              rows={2}
              maxLength={300}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Printed on the back of this card"
            />
            <div className="acc__note-actions">
              <button type="button" className="acc__link" onClick={done}>
                Done
              </button>
              {(item.note || draft) && (
                <button
                  type="button"
                  className="acc__link"
                  onClick={() => {
                    setDraft('')
                    if (item.note) onSaveNote(item, '')
                    setOpen(false)
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : item.note ? (
          <button
            type="button"
            className="acc__note-toggle"
            onClick={() => {
              setDraft(item.note || '')
              setOpen(true)
            }}
          >
            📝 “{item.note}” · <span className="acc__link-inline">edit</span>
          </button>
        ) : (
          <button
            type="button"
            className="acc__note-toggle"
            onClick={() => {
              setDraft('')
              setOpen(true)
            }}
          >
            + Add a personal note
          </button>
        )}

      </div>
    </li>
  )
}

function RecipientForm({ recipient, hasAccountAddress, onDone, onCancel }) {
  const [mode, setMode] = useState(recipient ? recipient.type : hasAccountAddress ? 'self' : 'other')
  const [name, setName] = useState(recipient?.type === 'other' ? recipient.name : '')
  const [addr, setAddr] = useState(
    recipient?.type === 'other' ? { ...emptyAddr, ...recipient.address } : emptyAddr
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const rec = mode === 'self' ? { type: 'self' } : { type: 'other', name, address: addr }
      const res = await api.put('/api/cart/shipping', { recipient: rec })
      onDone(res.recipient)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acc__card acc__card--wide" onSubmit={submit}>
      <h2 className="acc__title">Recipient</h2>
      <p className="acc__muted">Every card in this cart is mailed to this person.</p>

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
  const [recipient, setRecipient] = useState(null)
  const [price, setPrice] = useState({ priceCents: 0, currency: 'usd' })
  const [error, setError] = useState('')
  const [editRcpt, setEditRcpt] = useState(false)
  const [checkoutOrder, setCheckoutOrder] = useState(null)
  const [busy, setBusy] = useState(false)

  const hasAccountAddress = Boolean(user?.address?.line1 && user?.name)

  async function load() {
    try {
      const d = await api.get('/api/cart')
      setItems(d.items)
      setRecipient(d.recipient || null)
      setPrice({ priceCents: d.priceCents || 0, currency: d.currency || 'usd' })
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
      const { items } =
        qty <= 0
          ? await api.delete(`/api/cart/${it.id}`)
          : await api.put(`/api/cart/${it.id}`, { qty })
      setItems(items)
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveNote(it, note) {
    if ((it.note || '') === note) return
    try {
      const { items } = await api.put(`/api/cart/${it.id}`, { note })
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

  if (editRcpt) {
    return (
      <RecipientForm
        recipient={recipient}
        hasAccountAddress={hasAccountAddress}
        onDone={(r) => {
          setRecipient(r)
          setEditRcpt(false)
        }}
        onCancel={() => setEditRcpt(false)}
      />
    )
  }

  const count = items ? cardCount(items) : 0
  const total = count * price.priceCents

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
            {price.priceCents > 0 && (
              <>
                {' '}
                · {money(price.priceCents, price.currency)} each
              </>
            )}
          </p>

          <ul className="acc__list">
            {items.map((it) => (
              <CartLine
                key={it.id}
                item={it}
                priceCents={price.priceCents}
                currency={price.currency}
                onQty={setQty}
                onRemove={remove}
                onSaveNote={saveNote}
              />
            ))}
          </ul>

          <div className="acc__ship">
            <div>
              <span className="acc__label">Recipient</span>
              {recipient ? (
                <p className="acc__muted">{recipientSummary(recipient)}</p>
              ) : (
                <p className="acc__muted">Not set yet — every card ships to one person.</p>
              )}
            </div>
            <button className="acc__btn acc__btn--soft" onClick={() => setEditRcpt(true)}>
              {recipient ? 'Change' : 'Set recipient'}
            </button>
          </div>

          {total > 0 && (
            <p className="acc__cart-total">
              Total <strong>{money(total, price.currency)}</strong>
              <span className="acc__muted"> · {count} card{count > 1 ? 's' : ''}</span>
            </p>
          )}

          <div className="acc__actions">
            <button
              className="acc__btn"
              onClick={startCheckout}
              disabled={busy || !recipient}
            >
              {busy
                ? 'Loading…'
                : total > 0
                  ? `Checkout · ${money(total, price.currency)}`
                  : `Checkout · ${count} card${count > 1 ? 's' : ''}`}
            </button>
            <a className="acc__link" href="/#postcards">
              Add more
            </a>
            <button type="button" className="acc__link" onClick={clearAll}>
              Empty cart
            </button>
          </div>
          {!recipient && <p className="acc__error">Set the recipient before checkout.</p>}
          <p className="acc__muted acc__fine">
            We print each card with its note and mail them all to the recipient above.
          </p>
        </>
      )}
    </div>
  )
}
