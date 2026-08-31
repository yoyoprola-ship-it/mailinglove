import { useEffect, useState } from 'react'
import { api } from './api'

const STATUS_LABEL = {
  pending: 'Pending',
  printed: 'Printed',
  mailed: 'Mailed',
  cancelled: 'Cancelled',
}

function fmt(ms) {
  return ms ? new Date(ms).toLocaleDateString() : '—'
}

export default function Orders() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/orders')
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="acc__error">{error}</p>
  if (!orders) return <p className="acc__muted">Loading…</p>

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Your orders</h2>
      {orders.length === 0 && <p className="acc__muted">No orders yet.</p>}

      {orders.map((o) => (
        <div className="acc__order" key={o.id}>
          <div className="acc__order-head">
            <span className={`acc__badge acc__badge--${o.status}`}>
              {STATUS_LABEL[o.status] || o.status}
            </span>
            <span className="acc__muted">
              {fmt(o.createdAt)} ·{' '}
              {o.items.reduce((n, it) => n + (it.qty || 1), 0)} card
              {o.items.reduce((n, it) => n + (it.qty || 1), 0) > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="acc__order-items">
            {o.items.map((it, i) => (
              <li key={i}>
                {it.title}
                {(it.qty || 1) > 1 && ` ×${it.qty}`} → {it.recipient?.name || '—'} (
                {it.recipient?.address?.city}, {it.recipient?.address?.state})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
