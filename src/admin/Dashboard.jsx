import { useEffect, useState } from 'react'
import { api } from './api'

function fmtDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString()
}

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

  return (
    <div className="adm__grid">
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
