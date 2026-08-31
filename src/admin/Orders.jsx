import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const STATUSES = ['awaiting_payment', 'paid', 'printed', 'mailed', 'cancelled']

function fmt(ms) {
  return ms ? new Date(ms).toLocaleString() : '—'
}

const money = (c, ccy = 'usd') =>
  c == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(c / 100)

function addrLines(a) {
  if (!a) return []
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean)
}

export default function Orders() {
  const [orders, setOrders] = useState(null)
  const [filter, setFilter] = useState('paid')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`
      const { orders } = await api.get(`/api/admin/orders${q}`)
      setOrders(orders)
    } catch (e) {
      setError(e.message)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id, status) {
    try {
      await api.put(`/api/admin/orders/${id}`, { status })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Orders</h2>

      <div className="adm__chips">
        {['all', ...STATUSES].map((s) => (
          <button
            key={s}
            className={`adm__chip${filter === s ? ' is-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="adm__error">{error}</p>}
      {!orders && !error && <p className="adm__muted">Loading…</p>}
      {orders && !orders.length && <p className="adm__muted">No orders here.</p>}

      {orders &&
        orders.map((o) => (
          <div className="adm__order" key={o.id}>
            <div className="adm__order-top">
              <div>
                <strong>{o.userName || o.userEmail}</strong>{' '}
                <span className="adm__muted">{o.userEmail}</span>
                <div className="adm__muted">
                  {fmt(o.createdAt)}
                  {o.amountCents != null && ` · ${money(o.amountCents, o.currency)}`}
                  {o.paid ? ` · paid (${o.paymentProvider || '—'})` : ' · unpaid'}
                </div>
              </div>
              <select
                className="adm__input adm__input--sm"
                value={o.status}
                onChange={(e) => setStatus(o.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const rec = o.recipient || o.items[0]?.recipient
              return (
                <div className="adm__ship">
                  <strong>{rec?.name}</strong>
                  {addrLines(rec?.address).map((l, j) => (
                    <div key={j}>{l}</div>
                  ))}
                </div>
              )
            })()}

            <ul className="adm__order-items">
              {o.items.map((it, i) => (
                <li key={i} className="adm__order-item">
                  <img className="adm__order-thumb" src={it.image} alt={it.title} />
                  <div>
                    <strong>{it.title}</strong>{' '}
                    {(it.qty || 1) > 1 && <strong className="adm__qty-badge">×{it.qty}</strong>}{' '}
                    <span className="adm__muted">({it.category})</span>
                    {it.message && <div className="adm__msg">Note: “{it.message}”</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}
