import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { getPostcard } from './catalog.js'
import { validateAddress } from './userAuth.js'

const MAX_LINES = 60 // distinct designs in the cart
const MAX_QTY = 50 // copies of one design
const MAX_MESSAGE = 300
export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'printed', 'mailed', 'cancelled']

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clampQty = (v) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.min(MAX_QTY, Math.max(1, n)) : 1
}

// The whole cart ships to one recipient with one message. `self` = the
// account address (resolved at order time); `other` = a name + US address.
export function validateRecipient(r) {
  if (r == null || r.type === 'pending') return { errors: [], value: null }
  if (r.type === 'self') return { errors: [], value: { type: 'self' } }
  if (r.type === 'other') {
    const name = clip(r.name, 120)
    const { errors, value: address } = validateAddress(r.address || {}, 'Recipient')
    if (!name) errors.unshift('Recipient name is required.')
    return { errors, value: { type: 'other', name, address } }
  }
  return { errors: ['Choose who to send it to.'], value: null }
}

function cartLine(postcardId, qty) {
  const card = getPostcard(postcardId)
  if (!card) return null
  return {
    id: crypto.randomBytes(8).toString('hex'),
    postcardId: card.id,
    title: card.title,
    image: card.image,
    category: card.type,
    subcategory: card.subcategory || null,
    qty: clampQty(qty),
    addedAt: Date.now(),
  }
}

async function userRef(email) {
  return getDb().collection('users').doc(email)
}

export async function getCart(email) {
  const snap = await (await userRef(email)).get()
  const d = snap.exists ? snap.data() : {}
  return { items: d.cart || [], recipient: d.cartRecipient || null, message: d.cartMessage || '' }
}

export async function addItem(email, input) {
  const line = cartLine((input || {}).postcardId, 1)
  if (!line) return { ok: false, errors: ['That postcard is no longer available.'] }
  const ref = await userRef(email)
  const { items } = await getCart(email)

  const existing = items.find((i) => i.postcardId === line.postcardId)
  let merged = false
  if (existing) {
    existing.qty = clampQty((existing.qty || 1) + 1)
    merged = true
  } else {
    if (items.length >= MAX_LINES) return { ok: false, errors: ['Your cart is full.'] }
    items.push(line)
  }
  await ref.set({ cart: items, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: items, merged }
}

export async function updateItem(email, itemId, patch) {
  const ref = await userRef(email)
  const { items } = await getCart(email)
  const item = items.find((i) => i.id === itemId)
  if (!item) return { ok: false, errors: ['Item not found.'] }
  if (patch.qty !== undefined) item.qty = clampQty(patch.qty)
  await ref.set({ cart: items, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: items }
}

export async function decItem(email, postcardId) {
  const ref = await userRef(email)
  const { items } = await getCart(email)
  const idx = items.findIndex((i) => i.postcardId === postcardId)
  if (idx === -1) return { ok: true, cart: items }
  if ((items[idx].qty || 1) > 1) items[idx].qty = (items[idx].qty || 1) - 1
  else items.splice(idx, 1)
  await ref.set({ cart: items, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: items }
}

export async function removeItem(email, itemId) {
  const ref = await userRef(email)
  const { items } = await getCart(email)
  const next = items.filter((i) => i.id !== itemId)
  await ref.set({ cart: next, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: next }
}

export async function clearCart(email) {
  await (await userRef(email)).set({ cart: [], updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: [] }
}

// Set the one recipient + message for the whole cart.
export async function setCartShipping(email, input = {}) {
  const rec = validateRecipient(input.recipient)
  if (rec.errors.length) return { ok: false, errors: rec.errors }
  if (!rec.value) return { ok: false, errors: ['Choose who to send it to.'] }
  const message = clip(input.message, MAX_MESSAGE)
  await (await userRef(email)).set(
    { cartRecipient: rec.value, cartMessage: message, updatedAt: Date.now() },
    { merge: true }
  )
  return { ok: true, recipient: rec.value, message }
}

// Build an unpaid order from the cart + its shipping. Does NOT clear the
// cart — that happens on payment (markOrderPaid).
export async function createPendingOrder(email, priceCents) {
  const db = getDb()
  const ref = await userRef(email)
  const snap = await ref.get()
  const user = snap.exists ? snap.data() : {}
  const cart = user.cart || []
  if (!cart.length) return { ok: false, errors: ['Your cart is empty.'] }

  const rec = user.cartRecipient
  if (!rec) return { ok: false, errors: ['Set who the cards go to before checkout.'] }
  if (rec.type === 'self' && !(user.address && user.address.line1 && user.name)) {
    return { ok: false, errors: ['Add your name and address before checkout.'] }
  }
  const recipient =
    rec.type === 'self'
      ? { name: user.name, address: user.address }
      : { name: rec.name, address: rec.address }
  const message = user.cartMessage || ''

  const items = cart.map((i) => ({
    postcardId: i.postcardId,
    title: i.title,
    image: i.image,
    category: i.category,
    qty: clampQty(i.qty),
    message,
    recipient,
  }))

  const cardCount = items.reduce((n, i) => n + i.qty, 0)
  const amountCents = cardCount * Math.max(0, Math.trunc(priceCents))
  if (amountCents <= 0) return { ok: false, errors: ['Pricing is not set up yet.'] }

  const orderId = crypto.randomBytes(10).toString('hex')
  const order = {
    id: orderId,
    userEmail: email,
    userName: user.name || '',
    recipient,
    message,
    items,
    cardCount,
    unitPriceCents: priceCents,
    amountCents,
    currency: 'usd',
    paid: false,
    status: 'awaiting_payment',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.collection('orders').doc(orderId).set(order)
  return { ok: true, order }
}

export async function getOrder(orderId) {
  const snap = await getDb().collection('orders').doc(String(orderId)).get()
  return snap.exists ? snap.data() : null
}

// Idempotent: mark an order paid, then clear the buyer's cart + shipping.
export async function markOrderPaid(orderId, { provider, ref, amountCents }) {
  const db = getDb()
  const oref = db.collection('orders').doc(String(orderId))
  const snap = await oref.get()
  if (!snap.exists) return { ok: false, error: 'Order not found.' }
  const order = snap.data()
  if (order.paid) return { ok: true, order, already: true }
  if (amountCents != null && amountCents !== order.amountCents) {
    console.warn(`[pay] amount mismatch on ${orderId}: got ${amountCents}, expected ${order.amountCents}`)
    return { ok: false, error: 'Amount mismatch.' }
  }
  const patch = {
    paid: true,
    status: 'paid',
    paidAt: Date.now(),
    paymentProvider: provider,
    paymentRef: ref || null,
    updatedAt: Date.now(),
  }
  await oref.set(patch, { merge: true })
  await db
    .collection('users')
    .doc(order.userEmail)
    .set({ cart: [], cartMessage: '', updatedAt: Date.now() }, { merge: true })
  return { ok: true, order: { ...order, ...patch } }
}

export async function listOrders(email) {
  const snap = await getDb().collection('orders').where('userEmail', '==', email).get()
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt - a.createdAt)
}

// --- admin -----------------------------------------------------------

export async function listAllOrders({ status } = {}) {
  const snap = await getDb().collection('orders').orderBy('createdAt', 'desc').limit(200).get()
  let orders = snap.docs.map((d) => d.data())
  if (status && ORDER_STATUSES.includes(status)) orders = orders.filter((o) => o.status === status)
  return orders
}

export async function setOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: 'Bad status.' }
  const ref = getDb().collection('orders').doc(String(orderId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Order not found.' }
  await ref.set({ status, updatedAt: Date.now() }, { merge: true })
  return { ok: true, order: { ...snap.data(), status } }
}
