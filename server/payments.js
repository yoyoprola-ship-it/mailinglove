import Stripe from 'stripe'

// --- Stripe ---------------------------------------------------------

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

export const stripeConfigured = () => Boolean(stripe)
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

// --- PayPal (REST, no SDK) ---------------------------------------

const PP_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
const PP_BASE =
  PP_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
const PP_ID = process.env.PAYPAL_CLIENT_ID || ''
const PP_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || ''

export const paypalConfigured = () => Boolean(PP_ID && PP_SECRET)
export const paypalClientId = () => PP_ID
export const paypalEnv = () => PP_ENV

let ppToken = null
let ppTokenExp = 0

async function ppAccessToken() {
  if (ppToken && Date.now() < ppTokenExp) return ppToken
  const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PP_ID}:${PP_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`)
  ppToken = data.access_token
  ppTokenExp = Date.now() + (data.expires_in - 60) * 1000
  return ppToken
}

async function ppFetch(path, method, body) {
  const token = await ppAccessToken()
  const res = await fetch(`${PP_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  return data
}

const dollars = (cents) => (cents / 100).toFixed(2)

export async function paypalCreateOrder({ orderId, amountCents, currency }) {
  return ppFetch('/v2/checkout/orders', 'POST', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        custom_id: orderId,
        amount: { currency_code: currency.toUpperCase(), value: dollars(amountCents) },
      },
    ],
  })
}

export async function paypalCaptureOrder(paypalOrderId) {
  return ppFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, 'POST')
}

export async function paypalVerifyWebhook(headers, rawBody) {
  if (!PAYPAL_WEBHOOK_ID) return false
  try {
    const data = await ppFetch('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    })
    return data.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal] webhook verify failed:', err?.message || err)
    return false
  }
}
