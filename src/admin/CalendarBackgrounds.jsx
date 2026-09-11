import { useEffect, useState } from 'react'
import { api } from './api'

export default function CalendarBackgrounds() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [rev, setRev] = useState(0) // bumped after any change, to bust the <img> cache

  async function load() {
    try {
      const { backgrounds } = await api.get('/api/admin/calendar-backgrounds')
      setRows(backgrounds)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addFiles(files) {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true)
    setError('')
    try {
      for (const file of list) {
        const body = new FormData()
        body.append('image', file)
        const res = await fetch('/api/admin/calendar-backgrounds', {
          method: 'POST',
          credentials: 'same-origin',
          body,
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error || 'Upload failed.')
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function toggleHidden(bg) {
    setBusyId(bg.id)
    setError('')
    try {
      await api.post(`/api/admin/calendar-backgrounds/${bg.id}/hidden`, { hidden: !bg.hidden })
      setRev((r) => r + 1)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function remove(bg) {
    if (!confirm('Permanently delete this background? This cannot be undone.')) return
    setBusyId(bg.id)
    setError('')
    try {
      await api.delete(`/api/admin/calendar-backgrounds/${bg.id}`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  if (error && !rows) return <p className="adm__error">{error}</p>
  if (!rows) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Calendar backgrounds</h2>
      <p className="adm__muted adm__hint--top">
        Ready-made 8×10 backgrounds customers can pick from when building a
        calendar. Best as JPEG/WebP around 1600×2000 — bigger files just
        slow the page down without adding print quality.
      </p>

      <label className="adm__btn adm__chip--file" style={{ display: 'inline-block' }}>
        {uploading ? 'Uploading…' : '＋ Add backgrounds'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          disabled={uploading}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {error && <p className="adm__error">{error}</p>}

      <div className="adm__gallery">
        {rows.map((bg) => (
          <div className={`adm__gcard${bg.hidden ? ' is-hidden' : ''}`} key={bg.id}>
            <img className="adm__gimg" src={`${bg.thumb || bg.image}&r=${rev}`} alt="" loading="lazy" />
            <div className="adm__gbody">
              {bg.hidden && (
                <div className="adm__gtags">
                  <span className="adm__gtag">hidden</span>
                </div>
              )}
              <div className="adm__gactions">
                <a
                  className="adm__chip"
                  href={`${bg.image}&download=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
                <button
                  type="button"
                  className="adm__chip"
                  disabled={busyId === bg.id}
                  onClick={() => toggleHidden(bg)}
                >
                  {bg.hidden ? 'Show' : 'Hide'}
                </button>
                <button
                  type="button"
                  className="adm__chip adm__chip--danger"
                  disabled={busyId === bg.id}
                  onClick={() => remove(bg)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <p className="adm__muted">No backgrounds yet — add some above.</p>}
      </div>
    </div>
  )
}
