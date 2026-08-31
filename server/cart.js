import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { getPostcard } from './catalog.js'
import { validateAddress } from './userAuth.js'

const MAX_LINES = 50 // distinct cart lines
const MAX_QTY = 20 // copies of one line
const MAX_MESSAGE = 300
export const ORDER_STATUSES = ['pending', 'printed', 'mailed', 'cancelled']

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clampQty = (v) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.min(MAX_QTY, Math.max(1, n)) : 1
}

// Validate an incoming cart-item recipient. A missing/pending recipient is
// allowed in the cart (you add designs freely, then set who each goes to
// before ordering). `self` = use the account address, resolved at order
// time; `other` carries a name + US address.
function validateRecipient(r) {
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

function buildItem({ postcardId, message, recipient, qty }) {
  const card = getPostcard(postcardId)
  if (!card) return { errors: ['That postcard is no longer available.'], value: null }
  const rec = validateRecipient(recipient)
  if (rec.errors.length) return { errors: rec.errors, value: null }
  return {
    errors: [],
    value: {
      id: crypto.randomBytes(8).toString('hex'),
      postcardId: card.id,
      title: card.title,
      image: card.image,
      category: card.type,
      subcategory: card.subcategory || null,
      message: clip(message, MAX_MESSAGE),
      recipient: rec.value,
      qty: clampQty(qty),
      addedAt: Date.now(),
    },
  }
}

async function userRef(email) {
  return getDb().collection('users').doc(email)
}

export async function getCart(email) {
  const snap = await (await userRef(email)).get()
  return snap.exists ? snap.data().cart || [] : []
}

export async function addItem(email, input) {
  const { errors, value } = buildItem(input || {})
  if (errors.length) return { ok: false, errors }
  const ref = await userRef(email)
  const cart = await getCart(email)

  // Quick-add (no recipient, no message yet): if this exact design is
  // already in the cart unconfigured, bump its quantity instead of adding
  // a second identical pending line. Once a line has a recipient it's a
  // deliberate copy, so a re-add then makes a fresh line.
  if (!value.recipient && !value.message) {
    const pending = cart.find(
      (i) => i.postcardId === value.postcardId && !i.recipient && !i.message
    )
    if (pending) {
      pending.qty = clampQty((pending.qty || 1) + 1)
      await ref.set({ cart, updatedAt: Date.now() }, { merge: true })
      return { ok: true, cart, merged: true }
    }
  }

  if (cart.length >= MAX_LINES) return { ok: false, errors: ['Your cart is full.'] }
  cart.push(value)
  await ref.set({ cart, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart }
}

export async function updateItem(email, itemId, patch) {
  const ref = await userRef(email)
  const cart = await getCart(email)
  const item = cart.find((i) => i.id === itemId)
  if (!item) return { ok: false, errors: ['Item not found.'] }

  if (patch.message !== undefined) item.message = clip(patch.message, MAX_MESSAGE)
  if (patch.qty !== undefined) item.qty = clampQty(patch.qty)
  if (patch.recipient !== undefined) {
    const rec = validateRecipient(patch.recipient)
    if (rec.errors.length) return { ok: false, errors: rec.errors }
    item.recipient = rec.value
  }

  await ref.set({ cart, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart }
}

export async function clearCart(email) {
  await (await userRef(email)).set({ cart: [], updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: [] }
}

export async function removeItem(email, itemId) {
  const ref = await userRef(email)
  const cart = (await getCart(email)).filter((i) => i.id !== itemId)
  await ref.set({ cart, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart }
}

export async function placeOrder(email) {
  const db = getDb()
  const ref = await userRef(email)
  const snap = await ref.get()
  const user = snap.exists ? snap.data() : {}
  const cart = user.cart || []
  if (!cart.length) return { ok: false, errors: ['Your cart is empty.'] }

  const pending = cart.filter((i) => !i.recipient).length
  if (pending) {
    return {
      ok: false,
      errors: [`Set who ${pending === 1 ? 'a card goes' : `${pending} cards go`} to before ordering.`],
    }
  }

  const needsAccountAddr = cart.some((i) => i.recipient?.type === 'self')
  if (needsAccountAddr && !(user.address && user.address.line1 && user.name)) {
    return { ok: false, errors: ['Add your name and address before ordering to yourself.'] }
  }

  const items = cart.map((i) => ({
    postcardId: i.postcardId,
    title: i.title,
    image: i.image,
    category: i.category,
    message: i.message || '',
    qty: clampQty(i.qty),
    recipient:
      i.recipient.type === 'self'
        ? { name: user.name, address: user.address }
        : { name: i.recipient.name, address: i.recipient.address },
  }))

  const orderId = crypto.randomBytes(10).toString('hex')
  const order = {
    id: orderId,
    userEmail: email,
    userName: user.name || '',
    items,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.collection('orders').doc(orderId).set(order)
  await ref.set({ cart: [], updatedAt: Date.now() }, { merge: true })
  return { ok: true, order }
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
