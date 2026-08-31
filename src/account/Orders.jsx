import { useEffect, useState } from 'react'
import { api } from './api'

const STATUS_LABEL = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  printed: 'Printed',
  mailed: 'Mailed',
  cancelled: 'Cancelled',
}

const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString() : '—')
const money = (c, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format((c || 0) / 100)

export default function Orders() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    try {
      const d = await api.get('/api/orders')
      setOrders(d.orders)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const sess = p.get('stripe_session')
    if (sess) {
      api
        .get(`/api/pay/stripe/verify?session_id=${encodeURIComponent(sess)}`)
        .then((r) => setNotice(r.paid ? 'Payment received — your cards are queued for printing.' : ''))
        .catch(() => {})
        .finally(() => {
          history.replaceState(null, '', '/account?tab=orders')
          load()
        })
    } else {
      if (p.get('paid')) {
        setNotice('Payment received — your cards are queued for printing.')
        history.replaceState(null, '', '/account?tab=orders')
      }
      load()
    }
  }, [])

  if (error) return <p className="acc__error">{error}</p>
  if (!orders) return <p className="acc__muted">Loading…</p>

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Your orders</h2>
      {notice && <p className="acc__ok">{notice}</p>}
      {orders.length === 0 && <p className="acc__muted">No orders yet.</p>}

      {orders.map((o) => {
        const cards = o.items.reduce((n, it) => n + (it.qty || 1), 0)
        return (
          <div className="acc__order" key={o.id}>
            <div className="acc__order-head">
              <span className={`acc__badge acc__badge--${o.status}`}>
                {STATUS_LABEL[o.status] || o.status}
              </span>
              <span className="acc__muted">
                {fmt(o.createdAt)} · {cards} card{cards > 1 ? 's' : ''}
                {o.amountCents != null && ` · ${money(o.amountCents, o.currency)}`}
              </span>
            </div>
            {(() => {
              const rec = o.recipient || o.items[0]?.recipient
              return (
                <p className="acc__muted acc__order-to">
                  To {rec?.name || '—'}
                  {rec?.address && ` — ${rec.address.city}, ${rec.address.state}`}
                </p>
              )
            })()}
            <ul className="acc__order-items">
              {o.items.map((it, i) => (
                <li key={i}>
                  {it.title}
                  {(it.qty || 1) > 1 && ` ×${it.qty}`}
                  {it.message && <span className="acc__msg"> — “{it.message}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
