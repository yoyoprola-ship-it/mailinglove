import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export default function CalendarTemplates() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [rev, setRev] = useState(0)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [creating, setCreating] = useState(false)
  const addRef = useRef(null)

  async function load() {
    try {
      const d = await api.get('/api/admin/calendar-templates')
      setList(d.templates)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function create(e) {
    e.preventDefault()
    if (!name.trim() || !file) {
      setError('Give it a name and an image.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const body = new FormData()
      body.append('name', name.trim())
      body.append('image', file)
      const res = await fetch('/api/admin/calendar-templates', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add.')
      setName('')
      setFile(null)
      if (addRef.current) addRef.current.value = ''
      setRev((r) => r + 1)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function replace(t, f) {
    if (!f) return
    setBusyId(t.id)
    setError('')
    try {
      const body = new FormData()
      body.append('image', f)
      const res = await fetch(`/api/admin/calendar-templates/${t.id}/image`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Upload failed.')
      setRev((r) => r + 1)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function toggleHidden(t) {
    setBusyId(t.id)
    try {
      await api.put(`/api/admin/calendar-templates/${t.id}`, { hidden: !t.hidden })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function rename(t) {
    const nm = prompt('Template name', t.name)
    if (nm == null) return
    setBusyId(t.id)
    try {
      await api.put(`/api/admin/calendar-templates/${t.id}`, { name: nm })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function remove(t) {
    if (!confirm(`Permanently delete “${t.name}”? This cannot be undone.`)) return
    setBusyId(t.id)
    try {
      await api.delete(`/api/admin/calendar-templates/${t.id}`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  if (error && !list) return <p className="adm__error">{error}</p>
  if (!list) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Calendar templates</h2>
      <p className="adm__muted adm__hint--top">
        Upload the calendar artwork (grid + dates baked in) at 8×10 in, 300 DPI —
        2400 × 3000 px. Customers drop framed photos and styled text on top.
      </p>

      <form className="adm__addcard" onSubmit={create}>
        <div className="adm__field">
          <label className="adm__label">Name</label>
          <input
            className="adm__input"
            value={name}
            maxLength={80}
            placeholder="e.g. 2027 — Botanical"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="adm__field">
          <label className="adm__label">Template image (JPEG, PNG, or WebP)</label>
          <input
            ref={addRef}
            className="adm__input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <button className="adm__btn" type="submit" disabled={creating}>
          {creating ? 'Adding…' : 'Add template'}
        </button>
      </form>

      {error && <p className="adm__error">{error}</p>}

      <div className="adm__gallery">
        {list.map((t) => (
          <div className={`adm__gcard${t.hidden ? ' is-hidden' : ''}`} key={t.id}>
            <img
              className="adm__gimg"
              src={`${t.image}&r=${rev}`}
              alt={t.name}
              loading="lazy"
            />
            <div className="adm__gbody">
              <div className="adm__gtitle">{t.name}</div>
              {t.hidden && (
                <div className="adm__gtags">
                  <span className="adm__gtag">hidden</span>
                </div>
              )}
              <div className="adm__gactions">
                <label className="adm__chip adm__chip--file">
                  {busyId === t.id ? 'Uploading…' : 'Replace'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={busyId === t.id}
                    onChange={(e) => replace(t, e.target.files?.[0])}
                  />
                </label>
                <button className="adm__chip" disabled={busyId === t.id} onClick={() => rename(t)}>
                  Rename
                </button>
                <button
                  className="adm__chip"
                  disabled={busyId === t.id}
                  onClick={() => toggleHidden(t)}
                >
                  {t.hidden ? 'Show' : 'Hide'}
                </button>
                <button
                  className="adm__chip adm__chip--danger"
                  disabled={busyId === t.id}
                  onClick={() => remove(t)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!list.length && <p className="adm__muted">No templates yet.</p>}
      </div>
    </div>
  )
}
