import { useEffect, useRef, useState } from 'react'
import { api } from './api'

const money = (cents, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format((cents || 0) / 100)

let paypalSdkPromise = null
function loadPayPal(clientId) {
  if (paypalSdkPromise) return paypalSdkPromise
  paypalSdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&locale=en_US`
    s.onload = () => resolve(window.paypal)
    s.onerror = () => reject(new Error('PayPal SDK failed to load'))
    document.head.appendChild(s)
  })
  return paypalSdkPromise
}

export default function Checkout({ order, onBack }) {
  const [cfg, setCfg] = useState(null)
  const [eta, setEta] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ppRef = useRef(null)
  const ppRendered = useRef(false)

  useEffect(() => {
    api
      .get('/api/pay/config')
      .then(setCfg)
      .catch((e) => setError(e.message))

    const zip = order.recipient?.address?.zip
    if (zip) {
      api
        .get(`/api/delivery-estimate?zip=${encodeURIComponent(zip)}`)
        .then(setEta)
        .catch(() => {})
    }
  }, [order.recipient])

  useEffect(() => {
    if (!cfg?.paypal || ppRendered.current || !ppRef.current) return
    ppRendered.current = true
    loadPayPal(cfg.paypal.clientId)
      .then((paypal) => {
        paypal
          .Buttons({
            style: { layout: 'horizontal', height: 40, tagline: false },
            createOrder: () =>
              api.post('/api/pay/paypal/create', { orderId: order.id }).then((d) => d.id),
            onApprove: (data) =>
              api
                .post('/api/pay/paypal/capture', {
                  orderId: order.id,
                  paypalOrderId: data.orderID,
                })
                .then(() => {
                  window.location.href = '/account?tab=orders&paid=1'
                })
                .catch((e) => setError(e.message)),
            onError: () => setError('PayPal had a problem. Try again or use a card.'),
          })
          .render(ppRef.current)
      })
      .catch((e) => setError(e.message))
  }, [cfg, order.id])

  async function payWithCard() {
    setBusy(true)
    setError('')
    try {
      const { url } = await api.post('/api/pay/stripe/session', { orderId: order.id })
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="acc__card acc__card--wide">
      <h2 className="acc__title">Checkout</h2>
      <p className="acc__muted">
        {order.cardCount} card{order.cardCount > 1 ? 's' : ''} printed &amp; mailed — total{' '}
        <strong>{money(order.amountCents, order.currency)}</strong>
      </p>

      {eta && (
        <p className="acc__eta">
          🕓 USPS delivery: {eta.text}
          {eta.arriveBy &&
            ` — around ${new Date(eta.arriveBy + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}`}
        </p>
      )}
      <p className="acc__eta-note">
        ⚠ Delivery is ~2–5 business days <strong>after your cards are handed to USPS</strong>. We mail
        them within ~1–2 business days of your order.
      </p>

      {!cfg && !error && <p className="acc__muted">Loading payment options…</p>}
      {error && <p className="acc__error">{error}</p>}

      {cfg && (
        <div className="acc__pay">
          {cfg.stripe && (
            <button className="acc__btn" onClick={payWithCard} disabled={busy}>
              {busy ? 'Redirecting…' : 'Pay with card'}
            </button>
          )}
          {cfg.paypal && <div ref={ppRef} className="acc__paypal" />}
          {!cfg.stripe && !cfg.paypal && (
            <p className="acc__error">No payment method is configured yet.</p>
          )}
        </div>
      )}

      <button type="button" className="acc__link" onClick={onBack}>
        ‹ Back to cart
      </button>
    </div>
  )
}
