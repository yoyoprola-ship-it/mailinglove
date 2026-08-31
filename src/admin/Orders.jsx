import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const STATUSES = ['awaiting_payment', 'paid', 'printed', 'mailed', 'cancelled']

const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : '—')
const money = (c, ccy = 'usd') =>
  c == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(c / 100)

function addrLines(a) {
  if (!a) return []
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean)
}

function OrderRow({ o, onStatus, onOpenGallery }) {
  const [open, setOpen] = useState(false)
  const rec = o.recipient || o.items[0]?.recipient
  const cards = o.items.reduce((n, it) => n + (it.qty || 1), 0)

  return (
    <div className="adm__order">
      <button className="adm__order-summary" onClick={() => setOpen((v) => !v)}>
        <span className="adm__chevron">{open ? '▾' : '▸'}</span>
        <span className={`adm__badge adm__badge--${o.status}`}>{o.status.replace('_', ' ')}</span>
        <strong className="adm__order-who">{o.userName || o.userEmail}</strong>
        <span className="adm__muted adm__order-meta">
          {fmt(o.createdAt)}
          {o.amountCents != null && ` · ${money(o.amountCents, o.currency)}`}
          {` · ${cards} card${cards === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="adm__order-body">
          <select
            className="adm__input adm__input--sm"
            value={o.status}
            onChange={(e) => onStatus(o.id, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <p className="adm__muted">
            {o.userEmail}
            {o.paid ? ` · paid (${o.paymentProvider || '—'})` : ' · unpaid'}
          </p>

          <div className="adm__ship">
            <strong>{rec?.name}</strong>
            {addrLines(rec?.address).map((l, j) => (
              <div key={j}>{l}</div>
            ))}
          </div>

          <ul className="adm__order-items">
            {o.items.map((it, i) => (
              <li key={i} className="adm__order-item">
                <button
                  className="adm__order-thumbbtn"
                  onClick={() => onOpenGallery?.(it.postcardId)}
                  title="Open in the postcard library"
                >
                  <img className="adm__order-thumb" src={it.image} alt={it.title} />
                </button>
                <div>
                  <button
                    className="adm__linklike"
                    onClick={() => onOpenGallery?.(it.postcardId)}
                  >
                    {it.title}
                  </button>{' '}
                  {(it.qty || 1) > 1 && <strong className="adm__qty-badge">×{it.qty}</strong>}{' '}
                  <span className="adm__muted">({it.category})</span>
                  {it.message && <div className="adm__msg">Note: “{it.message}”</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Orders({ onOpenGallery }) {
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
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <p className="adm__error">{error}</p>}
      {!orders && !error && <p className="adm__muted">Loading…</p>}
      {orders && !orders.length && <p className="adm__muted">No orders here.</p>}

      {orders &&
        orders.map((o) => (
          <OrderRow key={o.id} o={o} onStatus={setStatus} onOpenGallery={onOpenGallery} />
        ))}
    </div>
  )
}
