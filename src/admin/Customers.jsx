import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import AuditHistory from './AuditHistory'

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : '—')
const fmtDateTime = (ms) => (ms ? new Date(ms).toLocaleString() : '—')

function ConsentLine({ consent }) {
  if (!consent || !consent.acceptedAt) {
    return (
      <p className="adm__consent adm__consent--none">
        No Terms &amp; Privacy acceptance on record — this account predates the
        consent checkbox.
      </p>
    )
  }
  const reconfirmed =
    consent.lastAcceptedAt && consent.lastAcceptedAt !== consent.acceptedAt
  return (
    <div className="adm__consent">
      <strong>✓ Accepted the Terms &amp; Conditions and Privacy Policy</strong>
      <div>
        {fmtDateTime(consent.acceptedAt)}
        {consent.acceptedIp && <> · IP {consent.acceptedIp}</>}
        {consent.termsVersion && <> · version {consent.termsVersion}</>}
      </div>
      {reconfirmed && (
        <div className="adm__muted">
          Last re-confirmed at sign-in {fmtDateTime(consent.lastAcceptedAt)}
          {consent.lastAcceptedIp && <> · IP {consent.lastAcceptedIp}</>}
        </div>
      )}
    </div>
  )
}

function addrLine(a) {
  if (!a || !a.line1) return null
  return [a.line1, a.line2, [a.city, a.state, a.zip].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ')
}

export default function Customers() {
  const [q, setQ] = useState('')
  const [customers, setCustomers] = useState(null)
  const [error, setError] = useState('')
  const [openEmail, setOpenEmail] = useState(null)
  const timer = useRef(null)

  function load(query) {
    api
      .get(`/api/admin/customers?q=${encodeURIComponent(query)}`)
      .then((d) => setCustomers(d.customers))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load('')
  }, [])

  function onSearch(v) {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => load(v), 250)
  }

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Customers</h2>
      <p className="adm__hint adm__hint--top">
        Search by name, email, or any part of an address. Open a customer to see
        their Terms &amp; Privacy acceptance and full change history — every
        profile edit, recipient address, and order, each with a timestamp and IP.
      </p>

      <input
        className="adm__input"
        placeholder="Search name, email, street, city, state, or ZIP…"
        value={q}
        onChange={(e) => onSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {error && <p className="adm__error">{error}</p>}
      {!customers && !error && <p className="adm__muted">Loading…</p>}
      {customers && !customers.length && (
        <p className="adm__muted">No customers match that search.</p>
      )}

      <div className="adm__cust-list">
        {customers &&
          customers.map((c) => (
            <div className="adm__cust" key={c.email}>
              <button
                className="adm__cust-row"
                onClick={() => setOpenEmail(openEmail === c.email ? null : c.email)}
              >
                <span className="adm__chevron">{openEmail === c.email ? '▾' : '▸'}</span>
                <span className="adm__cust-main">
                  <strong>{c.name || c.email}</strong>
                  {c.name && <span className="adm__muted"> · {c.email}</span>}
                  <div className="adm__muted">
                    {addrLine(c.address) || 'No address on file'}
                  </div>
                </span>
                <span className="adm__muted adm__cust-joined">
                  Joined {fmtDate(c.createdAt)}
                </span>
              </button>

              {openEmail === c.email && (
                <div className="adm__cust-body">
                  <ConsentLine consent={c.consent} />
                  <AuditHistory email={c.email} defaultOpen />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
