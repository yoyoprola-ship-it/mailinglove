import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { FONTS, LAYOUTS, PANELS, DEFAULT_LAYOUT } from '../sections/calendarRender'

function LayoutForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="adm__cal-layout">
      <label className="adm__label">Calendar position</label>
      <select className="adm__input" value={value.position} onChange={(e) => set('position', e.target.value)}>
        {LAYOUTS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>

      <label className="adm__label">Backing panel</label>
      <select className="adm__input" value={value.panel} onChange={(e) => set('panel', e.target.value)}>
        {PANELS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="adm__label">Title / month font</label>
      <select className="adm__input" value={value.titleFont} onChange={(e) => set('titleFont', e.target.value)}>
        {FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="adm__cal-colors">
        <label className="adm__label">
          Dates colour
          <input type="color" value={value.ink} onChange={(e) => set('ink', e.target.value)} />
        </label>
        <label className="adm__label">
          Accent (year / months)
          <input type="color" value={value.accent} onChange={(e) => set('accent', e.target.value)} />
        </label>
      </div>
    </div>
  )
}

export default function CalendarTemplates() {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [rev, setRev] = useState(0)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editLayout, setEditLayout] = useState(DEFAULT_LAYOUT)
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
      body.append('layout', JSON.stringify(layout))
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
      setLayout(DEFAULT_LAYOUT)
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

  async function put(id, patch) {
    setBusyId(id)
    setError('')
    try {
      await api.put(`/api/admin/calendar-templates/${id}`, patch)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function rename(t) {
    const nm = prompt('Template name', t.name)
    if (nm != null) put(t.id, { name: nm })
  }

  async function remove(t) {
    if (!confirm(`Permanently delete “${t.name}”? This cannot be undone.`)) return
    setBusyId(t.id)
    setError('')
    try {
      await api.delete(`/api/admin/calendar-templates/${t.id}`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  function openEdit(t) {
    setEditId(t.id)
    setEditLayout({ ...DEFAULT_LAYOUT, ...(t.layout || {}) })
  }

  if (error && !list) return <p className="adm__error">{error}</p>
  if (!list) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Calendar templates</h2>
      <p className="adm__muted adm__hint--top">
        Upload a background image at 8×10 in, 300 DPI (2400 × 3000 px). The
        2027 twelve-month grid + year is drawn on top by the site — set where
        and how below. Customers only add framed photos and one caption.
      </p>

      <form className="adm__addcard" onSubmit={create}>
        <div className="adm__field">
          <label className="adm__label">Name</label>
          <input
            className="adm__input"
            value={name}
            maxLength={80}
            placeholder="e.g. Botanical"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="adm__field">
          <label className="adm__label">Background image (JPEG, PNG, or WebP)</label>
          <input
            ref={addRef}
            className="adm__input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <LayoutForm value={layout} onChange={setLayout} />
        <button className="adm__btn" type="submit" disabled={creating}>
          {creating ? 'Adding…' : 'Add template'}
        </button>
      </form>

      {error && <p className="adm__error">{error}</p>}

      <div className="adm__gallery">
        {list.map((t) => (
          <div className={`adm__gcard${t.hidden ? ' is-hidden' : ''}`} key={t.id}>
            <img className="adm__gimg" src={`${t.image}&r=${rev}`} alt={t.name} loading="lazy" />
            <div className="adm__gbody">
              <div className="adm__gtitle">{t.name}</div>
              <div className="adm__gtags">
                <span className="adm__gtag">
                  {(t.layout?.position || 'bottom') === 'side' ? 'side strip' : 'bottom half'}
                </span>
                {t.hidden && <span className="adm__gtag">hidden</span>}
              </div>
              <div className="adm__gactions">
                <label className="adm__chip adm__chip--file">
                  {busyId === t.id ? '…' : 'Replace'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={busyId === t.id}
                    onChange={(e) => replace(t, e.target.files?.[0])}
                  />
                </label>
                <button className="adm__chip" disabled={busyId === t.id} onClick={() => openEdit(t)}>
                  Layout
                </button>
                <button className="adm__chip" disabled={busyId === t.id} onClick={() => rename(t)}>
                  Rename
                </button>
                <button
                  className="adm__chip"
                  disabled={busyId === t.id}
                  onClick={() => put(t.id, { hidden: !t.hidden })}
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

              {editId === t.id && (
                <div className="adm__cal-edit">
                  <LayoutForm value={editLayout} onChange={setEditLayout} />
                  <div className="adm__cal-edit-actions">
                    <button
                      className="adm__btn adm__btn--sm"
                      disabled={busyId === t.id}
                      onClick={async () => {
                        await put(t.id, { layout: editLayout })
                        setEditId(null)
                      }}
                    >
                      Save layout
                    </button>
                    <button className="adm__chip" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {!list.length && <p className="adm__muted">No templates yet.</p>}
      </div>
    </div>
  )
}
