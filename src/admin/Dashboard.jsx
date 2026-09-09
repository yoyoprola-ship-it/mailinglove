import { useEffect, useState } from 'react'
import { api } from './api'

function fmtDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString()
}

const money = (c) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'usd' }).format((c || 0) / 100)
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')

const flag = (cc) =>
  /^[A-Z]{2}$/.test(cc || '')
    ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
    : '🌐'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/admin/stats')
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="adm__error">{error}</p>
  if (!stats) return <p className="adm__muted">Loading…</p>
  if (!stats.available) {
    return <p className="adm__muted">Analytics need firebase-admin credentials on the server.</p>
  }

  const maxViews = Math.max(1, ...stats.days.map((d) => d.views))
  const countries = stats.countries || []
  const maxCountry = Math.max(1, ...countries.map((c) => c.count))

  const f = stats.funnel || { pageViews: 0, addToCart: 0, initiateCheckout: 0, purchase: 0 }
  const funnelRows = [
    { label: 'Page views', n: f.pageViews, of: f.pageViews },
    { label: 'Added to cart', n: f.addToCart, of: f.pageViews },
    { label: 'Checkout started', n: f.initiateCheckout, of: f.addToCart },
    { label: 'Purchases', n: f.purchase, of: f.initiateCheckout },
  ]
  const maxFunnel = Math.max(1, f.pageViews, f.addToCart, f.initiateCheckout, f.purchase)

  return (
    <div className="adm__grid">
      <section className="adm__panel">
        <h2 className="adm__h2">Funnel &amp; revenue</h2>
        <p className="adm__hint adm__hint--top">
          First-party events over the last 30 days (before any ad-blocker loss).
        </p>
        <div className="adm__kpis">
          <div className="adm__kpi">
            <span className="adm__kpi-n">{money(stats.revenueCents)}</span>
            <span className="adm__kpi-l">revenue (30 days)</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{f.purchase}</span>
            <span className="adm__kpi-l">purchases</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{pct(f.purchase, f.pageViews)}</span>
            <span className="adm__kpi-l">views → purchase</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{stats.events?.sign_in || 0}</span>
            <span className="adm__kpi-l">sign-ins</span>
          </div>
        </div>
        <div className="adm__bars">
          {funnelRows.map((r) => (
            <div className="adm__bar-row" key={r.label}>
              <span className="adm__bar-day" style={{ width: 120 }}>
                {r.label}
              </span>
              <span className="adm__bar-track">
                <span
                  className="adm__bar-fill"
                  style={{ width: `${(r.n / maxFunnel) * 100}%` }}
                />
              </span>
              <span className="adm__bar-n">
                {r.n}
                {r.label !== 'Page views' && (
                  <span className="adm__muted"> · {pct(r.n, r.of)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="adm__panel">
        <h2 className="adm__h2">Visits</h2>
        <div className="adm__kpis">
          <div className="adm__kpi">
            <span className="adm__kpi-n">{stats.today.views}</span>
            <span className="adm__kpi-l">today ({stats.today.uniques} unique)</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{stats.last7}</span>
            <span className="adm__kpi-l">last 7 days</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{stats.last30}</span>
            <span className="adm__kpi-l">last 30 days</span>
          </div>
          <div className="adm__kpi">
            <span className="adm__kpi-n">{stats.ordersPending || 0}</span>
            <span className="adm__kpi-l">orders to fulfill</span>
          </div>
        </div>

        <div className="adm__bars">
          {stats.days.map((d) => (
            <div className="adm__bar-row" key={d.day}>
              <span className="adm__bar-day">{d.day.slice(5)}</span>
              <span className="adm__bar-track">
                <span className="adm__bar-fill" style={{ width: `${(d.views / maxViews) * 100}%` }} />
              </span>
              <span className="adm__bar-n">{d.views}</span>
            </div>
          ))}
          {!stats.days.length && <p className="adm__muted">No visits recorded yet.</p>}
        </div>
      </section>

      <section className="adm__panel">
        <h2 className="adm__h2">Where visitors are</h2>
        <p className="adm__hint adm__hint--top">
          Countries of unique visitors over the last 30 days.
        </p>
        <div className="adm__bars">
          {countries.map((c) => (
            <div className="adm__bar-row adm__geo-row" key={c.code}>
              <span className="adm__geo-name">
                {flag(c.code)} {c.name}
              </span>
              <span className="adm__bar-track">
                <span
                  className="adm__bar-fill"
                  style={{ width: `${(c.count / maxCountry) * 100}%` }}
                />
              </span>
              <span className="adm__bar-n">{c.count}</span>
            </div>
          ))}
          {!countries.length && (
            <p className="adm__muted">No location data yet — it fills in as visitors arrive.</p>
          )}
        </div>
      </section>

      <section className="adm__panel">
        <h2 className="adm__h2">Customers ({stats.usersTotal || 0})</h2>
        <table className="adm__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Location</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {(stats.usersRecent || []).map((u, i) => (
              <tr key={i}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{u.hasAddress ? `${u.city}, ${u.state}` : 'no address'}</td>
                <td>{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
            {!(stats.usersRecent || []).length && (
              <tr>
                <td colSpan={4} className="adm__muted">
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
