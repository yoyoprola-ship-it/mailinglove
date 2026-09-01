import crypto from 'node:crypto'
import { getDb } from './firebaseAdmin.js'
import { getPostcard } from './catalog.js'
import { validateAddress } from './userAuth.js'
import { sendEmail, emailConfigured } from './notify.js'
import { renderEmail } from './emailTemplate.js'

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

export const lineTotal = (i) => (i.unitPriceCents || 0) * clampQty(i.qty)
export const cartTotal = (items) => (items || []).reduce((n, i) => n + lineTotal(i), 0)

async function cartLine(postcardId, qty, unitPriceCents) {
  const card = await getPostcard(postcardId)
  if (!card) return null
  return {
    id: crypto.randomBytes(8).toString('hex'),
    kind: 'postcard',
    postcardId: card.id,
    title: card.title,
    image: card.image,
    category: card.type,
    subcategory: card.subcategory || null,
    unitPriceCents: Math.max(0, Math.trunc(unitPriceCents || 0)),
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

export async function addItem(email, input, unitPriceCents) {
  const line = await cartLine((input || {}).postcardId, 1, unitPriceCents)
  if (!line) return { ok: false, errors: ['That postcard is no longer available.'] }
  const ref = await userRef(email)
  const { items } = await getCart(email)

  const existing = items.find((i) => i.postcardId === line.postcardId)
  let merged = false
  if (existing) {
    existing.qty = clampQty((existing.qty || 1) + 1)
    if (!existing.unitPriceCents) existing.unitPriceCents = line.unitPriceCents
    merged = true
  } else {
    if (items.length >= MAX_LINES) return { ok: false, errors: ['Your cart is full.'] }
    items.push(line)
  }
  await ref.set({ cart: items, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: items, merged }
}

// A finished photo-print the customer composed in the browser.
export async function addPhotoItem(email, p = {}) {
  const ref = await userRef(email)
  const { items } = await getCart(email)
  if (items.length >= MAX_LINES) return { ok: false, errors: ['Your cart is full.'] }

  items.push({
    id: crypto.randomBytes(8).toString('hex'),
    kind: 'photo',
    postcardId: null,
    photoId: p.photoId,
    storagePath: p.storagePath,
    contentType: p.contentType || 'image/jpeg',
    formatId: p.formatId,
    formatLabel: p.formatLabel,
    title: p.title || `Photo print — ${p.formatLabel}`,
    image: `/api/photo-image/${p.photoId}`,
    width: Math.trunc(p.width || 0),
    height: Math.trunc(p.height || 0),
    unitPriceCents: Math.max(0, Math.trunc(p.unitPriceCents || 0)),
    qty: 1,
    note: '',
    addedAt: Date.now(),
  })
  await ref.set({ cart: items, updatedAt: Date.now() }, { merge: true })
  return { ok: true, cart: items }
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
export async function setCartShipping(email, input = {}, meta = {}) {
  const rec = validateRecipient(input.recipient)
  if (rec.errors.length) return { ok: false, errors: rec.errors }
  if (!rec.value) return { ok: false, errors: ['Choose who to send it to.'] }

  const ref = await userRef(email)
  const prev = (await ref.get()).data()?.cartRecipient || null

  await ref.set({ cartRecipient: rec.value, updatedAt: Date.now() }, { merge: true })

  if (JSON.stringify(prev) !== JSON.stringify(rec.value)) {
    const { logChange } = await import('./audit.js')
    logChange({
      email,
      kind: 'cart.recipient',
      before: prev,
      after: rec.value,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }
  return { ok: true, recipient: rec.value }
}

// Build an unpaid order from the cart + its shipping. Does NOT clear the
// cart — that happens on payment (markOrderPaid). Prices come from each
// line (postcards and photo prints can differ); `fallbackUnitCents` fills
// in for older postcard lines saved before per-line pricing.
export async function createPendingOrder(email, fallbackUnitCents = 0, meta = {}) {
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

  const items = cart.map((i) => {
    const unitPriceCents = i.unitPriceCents || fallbackUnitCents
    const base = {
      kind: i.kind || 'postcard',
      title: i.title,
      image: i.image,
      qty: clampQty(i.qty),
      unitPriceCents,
      message: i.note || '',
      recipient,
    }
    if (i.kind === 'photo') {
      return {
        ...base,
        postcardId: null,
        photoId: i.photoId,
        storagePath: i.storagePath || null,
        contentType: i.contentType || 'image/jpeg',
        formatId: i.formatId || null,
        formatLabel: i.formatLabel || null,
        width: i.width || 0,
        height: i.height || 0,
      }
    }
    return { ...base, postcardId: i.postcardId, category: i.category || null }
  })

  const cardCount = items.reduce((n, i) => n + i.qty, 0)
  const amountCents = items.reduce((n, i) => n + i.unitPriceCents * i.qty, 0)
  if (amountCents <= 0) return { ok: false, errors: ['Pricing is not set up yet.'] }

  const orderId = crypto.randomBytes(10).toString('hex')
  const order = {
    id: orderId,
    userEmail: email,
    userName: user.name || '',
    recipient,
    items,
    cardCount,
    amountCents,
    currency: 'usd',
    paid: false,
    status: 'awaiting_payment',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.collection('orders').doc(orderId).set(order)

  // Freeze exactly what address these cards will be mailed to, at this moment.
  const { logChange } = await import('./audit.js')
  logChange({
    email,
    kind: 'order.created',
    before: null,
    after: { recipient, cardCount, amountCents, currency: 'usd' },
    orderId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

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

  import('./audit.js').then(({ logChange }) =>
    logChange({
      email: order.userEmail,
      kind: 'order.paid',
      before: null,
      after: {
        recipient: order.recipient,
        amountCents: order.amountCents,
        provider,
        paymentRef: ref || null,
      },
      orderId: order.id,
    })
  )

  return { ok: true, order: { ...order, ...patch } }
}

// Fire-and-forget payment receipt to the buyer (first time an order is paid).
function sendReceipt(order) {
  if (!emailConfigured() || !order.userEmail) return
  const cards = (order.items || []).reduce((n, i) => n + (i.qty || 1), 0)
  const designs = (order.items || []).map(
    (i) =>
      `${i.title}${(i.qty || 1) > 1 ? ` ×${i.qty}` : ''}${i.message ? ` — “${i.message}”` : ''}`
  )
  const rec = order.recipient || order.items?.[0]?.recipient
  const oid = String(order.id).slice(0, 8)
  const ship = [rec?.name, shipLine(rec?.address)].filter(Boolean).join('\n')

  sendEmail(
    order.userEmail,
    `Your MailingLove receipt — Order #${oid}`,
    renderEmail({
      preheader: `Payment received — ${money(order.amountCents, order.currency)} for order #${oid}.`,
      title: 'Payment received',
      greeting: `Hi${order.userName ? ' ' + order.userName : ''},`,
      blocks: [
        { p: 'Thanks — your payment went through and your order is queued for printing.' },
        {
          rows: [
            ['Order', `#${oid}`],
            ['Paid', `${money(order.amountCents, order.currency)} · ${order.paymentProvider || 'card'}`],
            ['Items', `${cards} print${cards === 1 ? '' : 's'}`],
            ['Mailing to', ship || '—'],
          ],
        },
        { small: 'In this order:' },
        { list: designs },
        { hr: true },
        {
          small:
            'Delivery is about 3–9 business days after we hand your order to USPS (we mail within ~1–2 business days). We will email you when it is printed and when it ships.',
        },
      ],
      cta: { label: 'View your orders', href: 'https://mailinglove.com/account?tab=orders' },
    })
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
    title: "Your order is being printed",
    line: 'Your order has been printed and is being prepared for mailing.',
  },
  mailed: {
    subject: 'Your MailingLove order is on its way',
    title: 'On its way',
    line: 'Your order has been handed to USPS. First-Class Mail usually arrives 3–9 business days after that.',
  },
  cancelled: {
    subject: 'Your MailingLove order was cancelled',
    title: 'Order cancelled',
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
    const oid = String(order.id).slice(0, 8)
    sendEmail(
      order.userEmail,
      tpl.subject,
      renderEmail({
        preheader: tpl.line,
        title: tpl.title,
        greeting: `Hi${order.userName ? ' ' + order.userName : ''},`,
        blocks: [
          { p: tpl.line },
          {
            rows: [
              ['Order', `#${oid}`],
              ['Items', `${cards} print${cards === 1 ? '' : 's'}`],
              ...(order.recipient?.name ? [['To', order.recipient.name]] : []),
            ],
          },
        ],
        cta: { label: 'View your orders', href: 'https://mailinglove.com/account?tab=orders' },
      })
    ).catch((err) => console.error('[order] status email failed:', err?.message || err))
  }

  return { ok: true, order: { ...order, status } }
}
