import { useEffect, useState } from 'react'
import { api } from './api'

const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : '—')

const KIND_LABEL = {
  'consent.accept': 'Accepted the Terms & Conditions and Privacy Policy',
  'profile.update': 'Edited their account (name / address)',
  'cart.recipient': 'Changed the cart recipient',
  'order.created': 'Placed an order',
  'order.paid': 'Paid an order',
  'order.status': 'Order status changed',
}

function addrLine(a) {
  if (!a) return '—'
  return [a.line1, a.line2, [a.city, a.state, a.zip].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ')
}

// A recipient/profile value can be { name, address } or a cart recipient
// ({ type:'self' } / { type:'other', name, address }).
function who(v) {
  if (!v) return null
  if (v.type === 'self') return { name: '(their own address)', address: null }
  if (v.type === 'other') return { name: v.name || '', address: v.address }
  if (v.type === 'pending') return { name: '(not chosen yet)', address: null }
  return { name: v.name || '', address: v.address }
}

function Value({ v }) {
  const w = who(v)
  if (!w) return <span className="adm__aud-none">—</span>
  return (
    <span>
      {w.name && <strong>{w.name}</strong>}
      {w.address && <span className="adm__aud-addr"> {addrLine(w.address)}</span>}
    </span>
  )
}

export default function AuditHistory({ email, defaultOpen = false }) {
  const [entries, setEntries] = useState(null)
  const [open, setOpen] = useState(defaultOpen)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !email || entries) return
    api
      .get(`/api/admin/audit/${encodeURIComponent(email)}`)
      .then((d) => setEntries(d.entries || []))
      .catch((e) => setError(e.message))
  }, [open, email, entries])

  // reset when the customer changes
  useEffect(() => {
    setEntries(null)
    setError('')
  }, [email])

  return (
    <div className="adm__aud">
      <button className="adm__aud-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Change history {entries ? `(${entries.length})` : ''}
      </button>

      {open && (
        <div className="adm__aud-body">
          {error && <p className="adm__error">{error}</p>}
          {!entries && !error && <p className="adm__muted">Loading…</p>}
          {entries && !entries.length && (
            <p className="adm__muted">Nothing recorded for this customer yet.</p>
          )}
          {entries &&
            entries.map((e) => (
              <div className="adm__aud-row" key={e.id}>
                <div className="adm__aud-when">
                  {fmt(e.at)}
                  {e.ip && <span className="adm__aud-ip"> · {e.ip}</span>}
                </div>
                <div className="adm__aud-kind">{KIND_LABEL[e.kind] || e.kind}</div>

                {e.kind === 'consent.accept' && (
                  <div className="adm__aud-diff">
                    <div className="adm__muted">
                      Terms version {e.after?.termsVersion || '—'}
                      {e.before?.termsVersion &&
                        e.before.termsVersion !== e.after?.termsVersion &&
                        ` (previously ${e.before.termsVersion})`}
                    </div>
                  </div>
                )}

                {(e.kind === 'profile.update' || e.kind === 'cart.recipient') && (
                  <div className="adm__aud-diff">
                    <div>
                      <span className="adm__aud-tag">was</span> <Value v={e.before} />
                    </div>
                    <div>
                      <span className="adm__aud-tag adm__aud-tag--new">now</span>{' '}
                      <Value v={e.after} />
                    </div>
                  </div>
                )}

                {(e.kind === 'order.created' || e.kind === 'order.paid') && (
                  <div className="adm__aud-diff">
                    <div>
                      <span className="adm__aud-tag">to</span> <Value v={e.after?.recipient} />
                    </div>
                    {e.orderId && (
                      <div className="adm__muted">
                        order #{String(e.orderId).slice(0, 8)}
                        {e.after?.amountCents != null &&
                          ` · $${(e.after.amountCents / 100).toFixed(2)}`}
                        {e.after?.provider && ` · ${e.after.provider}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
