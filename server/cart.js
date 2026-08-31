import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { getPostcard } from './catalog.js'
import { validateAddress } from './userAuth.js'
import { sendEmail, emailConfigured } from './notify.js'

const MAX_LINES = 60 // distinct designs in the cart
const MAX_QTY = 50 // copies of one design
const MAX_MESSAGE = 300
export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'printed', 'mailed', 'cancelled']

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const money = (cents, ccy = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format((cents || 0) / 100)
const shipLine = (a) =>
  a ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(', ') : ''
const clampQty = (v) => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? Math.min(MAX_QTY, Math.max(1, n)) : 1
}

// The whole cart ships to one recipient (each card carries its own note).
// `self` = the account address (resolved at order time); `other` = a name +
// US address.
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

async function cartLine(postcardId, qty) {
  const card = await getPostcard(postcardId)
  if (!card) return null
  return {
    id: crypto.randomBytes(8).toString('hex'),
    postcardId: card.id,
    title: card.title,
    image: card.image,
    category: card.type,
    subcategory: card.subcategory || null,
    qty: clampQty(qty),
    note: '', // personal note printed on the back of this card
    addedAt: Date.now(),
  }
}

async function userRef(email) {
  return getDb().collection('users').doc(email)
}

export async function getCart(email) {
  const snap = await (await userRef(email)).get()
  const d = snap.exists ? snap.data() : {}
  return { items: d.cart || [], recipient: d.cartRecipient || null }
}

export async function addItem(email, input) {
  const line = await cartLine((input || {}).postcardId, 1)
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
  if (patch.note !== undefined) item.note = clip(patch.note, MAX_MESSAGE)
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

// The whole cart ships to one recipient; each card carries its own note.
export async function setCartShipping(email, input = {}) {
  const rec = validateRecipient(input.recipient)
  if (rec.errors.length) return { ok: false, errors: rec.errors }
  if (!rec.value) return { ok: false, errors: ['Choose who to send it to.'] }
  await (await userRef(email)).set(
    { cartRecipient: rec.value, updatedAt: Date.now() },
    { merge: true }
  )
  return { ok: true, recipient: rec.value }
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

  const items = cart.map((i) => ({
    postcardId: i.postcardId,
    title: i.title,
    image: i.image,
    category: i.category,
    qty: clampQty(i.qty),
    message: i.note || '',
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
    .set({ cart: [], updatedAt: Date.now() }, { merge: true })

  sendReceipt({ ...order, ...patch })

  return { ok: true, order: { ...order, ...patch } }
}

// Fire-and-forget payment receipt to the buyer (first time an order is paid).
function sendReceipt(order) {
  if (!emailConfigured() || !order.userEmail) return
  const cards = (order.items || []).reduce((n, i) => n + (i.qty || 1), 0)
  const designs = (order.items || [])
    .map(
      (i) =>
        `  • ${i.title}${(i.qty || 1) > 1 ? ` ×${i.qty}` : ''}${i.message ? ` — “${i.message}”` : ''}`
    )
    .join('\n')
  const rec = order.recipient || order.items?.[0]?.recipient
  const oid = String(order.id).slice(0, 8)

  sendEmail(
    order.userEmail,
    `Your MailingLove receipt — Order #${oid}`,
    `Hi${order.userName ? ' ' + order.userName : ''},\n\n` +
      `Thanks — your payment went through. Here's your receipt.\n\n` +
      `Order #${oid}\n` +
      `Paid: ${money(order.amountCents, order.currency)} via ${order.paymentProvider || 'card'}\n` +
      `${cards} card${cards === 1 ? '' : 's'} printed & mailed to:\n` +
      `${rec?.name || ''}\n${shipLine(rec?.address)}\n\n` +
      `Designs:\n${designs}\n\n` +
      `Delivery: about 3–9 business days after your cards are handed to USPS ` +
      `(we mail them within ~1–2 business days). We'll email you when they're printed and when they ship.\n\n` +
      `— MailingLove`
  ).catch((err) => console.error('[order] receipt email failed:', err?.message || err))
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

const STATUS_EMAIL = {
  printed: {
    subject: 'Your MailingLove order is being printed',
    line: 'Your cards have been printed and are being prepared for mailing.',
  },
  mailed: {
    subject: 'Your MailingLove cards are on their way',
    line: 'Your cards have been handed to USPS. First-Class Mail usually arrives 3–9 business days after that.',
  },
  cancelled: {
    subject: 'Your MailingLove order was cancelled',
    line: 'Your order has been cancelled. If you were charged, a refund follows to your original payment method.',
  },
}

export async function setOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: 'Bad status.' }
  const ref = getDb().collection('orders').doc(String(orderId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: 'Order not found.' }
  const order = snap.data()
  if (order.status === status) return { ok: true, order }

  await ref.set({ status, updatedAt: Date.now() }, { merge: true })

  // Fire-and-forget customer notification for the meaningful transitions.
  const tpl = STATUS_EMAIL[status]
  if (tpl && emailConfigured() && order.userEmail) {
    const cards = (order.items || []).reduce((n, i) => n + (i.qty || 1), 0)
    sendEmail(
      order.userEmail,
      tpl.subject,
      `Hi${order.userName ? ' ' + order.userName : ''},\n\n${tpl.line}\n\n` +
        `Order: #${String(order.id).slice(0, 8)} · ${cards} card${cards === 1 ? '' : 's'}` +
        `${order.recipient?.name ? ` to ${order.recipient.name}` : ''}.\n\n— MailingLove`
    ).catch((err) => console.error('[order] status email failed:', err?.message || err))
  }

  return { ok: true, order: { ...order, status } }
}
