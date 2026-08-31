import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'

const EMPTY_NEW = { type: '', sub: '', title: '', file: null }

export default function Gallery({ focusId, onFocusHandled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [type, setType] = useState('birthday')
  const [sub, setSub] = useState(null)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState('')
  const [adding, setAdding] = useState(false)
  const [nw, setNw] = useState(EMPTY_NEW)
  const [creating, setCreating] = useState(false)
  const focusRef = useRef(null)

  async function load() {
    try {
      setData(await api.get('/api/admin/catalog'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // When arriving from an order, jump to that design.
  useEffect(() => {
    if (!focusId || !data) return
    const card = data.postcards.find((p) => p.id === focusId)
    if (card) {
      setType(card.type)
      setSub(card.subcategory)
      setQ('')
    }
    const t1 = setTimeout(
      () => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      60
    )
    const t2 = setTimeout(() => onFocusHandled?.(), 4000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [focusId, data, onFocusHandled])

  const activeType = useMemo(
    () => data?.types.find((t) => t.id === type) || data?.types[0],
    [data, type]
  )
  const newType = useMemo(
    () => data?.types.find((t) => t.id === nw.type),
    [data, nw.type]
  )

  const cards = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.postcards.filter((p) => {
      if (needle) return p.title.toLowerCase().includes(needle) || p.id.includes(needle)
      return p.type === activeType?.id && (!sub || p.subcategory === sub)
    })
  }, [data, activeType, sub, q])

  async function upload(card, file) {
    if (!file) return
    setBusyId(card.id)
    setError('')
    try {
      const body = new FormData()
      body.append('image', file)
      const res = await fetch(`/api/admin/catalog/${card.id}/image`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Upload failed.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function revert(card) {
    if (!confirm('Remove the uploaded hi-res file and go back to the placeholder?')) return
    setBusyId(card.id)
    try {
      await api.delete(`/api/admin/catalog/${card.id}/image`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function removeCard(card) {
    const msg = card.custom
      ? `Delete “${card.title}” for good? This removes it from the store and deletes its image.`
      : `Hide “${card.title}” from the store? You can restore it later.`
    if (!confirm(msg)) return
    setBusyId(card.id)
    setError('')
    try {
      await api.delete(`/api/admin/catalog/${card.id}`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function restore(card) {
    setBusyId(card.id)
    setError('')
    try {
      await api.post(`/api/admin/catalog/${card.id}/restore`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function create(e) {
    e.preventDefault()
    if (!nw.type || !nw.title.trim() || !nw.file) {
      setError('Pick a category, a title, and an image.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const body = new FormData()
      body.append('type', nw.type)
      if (nw.sub) body.append('subcategory', nw.sub)
      body.append('title', nw.title.trim())
      body.append('image', nw.file)
      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add the postcard.')
      setNw(EMPTY_NEW)
      setAdding(false)
      if (d.card) {
        setType(d.card.type)
        setSub(d.card.subcategory || null)
        setQ('')
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  if (error && !data) return <p className="adm__error">{error}</p>
  if (!data) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Postcard library</h2>
      <p className="adm__muted adm__hint--top">
        Add or remove designs, download one to print, or upload a higher-quality
        file to replace it everywhere.
      </p>

      <button className="adm__btn" onClick={() => setAdding((v) => !v)}>
        {adding ? 'Cancel' : '＋ Add a postcard'}
      </button>

      {adding && (
        <form className="adm__addcard" onSubmit={create}>
          <div className="adm__field">
            <label className="adm__label">Category</label>
            <select
              className="adm__input"
              value={nw.type}
              onChange={(e) => setNw({ ...nw, type: e.target.value, sub: '' })}
            >
              <option value="">Choose…</option>
              {data.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {newType?.subcategories?.length > 0 && (
            <div className="adm__field">
              <label className="adm__label">Subcategory (optional)</label>
              <select
                className="adm__input"
                value={nw.sub}
                onChange={(e) => setNw({ ...nw, sub: e.target.value })}
              >
                <option value="">None</option>
                {newType.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="adm__field">
            <label className="adm__label">Title</label>
            <input
              className="adm__input"
              value={nw.title}
              maxLength={120}
              placeholder="e.g. Watercolor birthday cake"
              onChange={(e) => setNw({ ...nw, title: e.target.value })}
            />
          </div>

          <div className="adm__field">
            <label className="adm__label">Image (JPEG, PNG, or WebP)</label>
            <input
              className="adm__input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setNw({ ...nw, file: e.target.files?.[0] || null })}
            />
          </div>

          <button className="adm__btn" type="submit" disabled={creating}>
            {creating ? 'Adding…' : 'Add to catalog'}
          </button>
        </form>
      )}

      <input
        className="adm__input"
        placeholder="Search by title or id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ margin: '14px 0 12px' }}
      />

      {!q && (
        <>
          <div className="adm__chips">
            {data.types.map((t) => (
              <button
                key={t.id}
                className={`adm__chip${activeType?.id === t.id ? ' is-active' : ''}`}
                onClick={() => {
                  setType(t.id)
                  setSub(null)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {activeType?.subcategories?.length > 0 && (
            <div className="adm__chips">
              <button
                className={`adm__chip${!sub ? ' is-active' : ''}`}
                onClick={() => setSub(null)}
              >
                all
              </button>
              {activeType.subcategories.map((s) => (
                <button
                  key={s.id}
                  className={`adm__chip${sub === s.id ? ' is-active' : ''}`}
                  onClick={() => setSub(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="adm__error">{error}</p>}

      <div className="adm__gallery">
        {cards.map((c) => (
          <div
            className={`adm__gcard${c.id === focusId ? ' is-focus' : ''}${
              c.hidden ? ' is-hidden' : ''
            }`}
            key={c.id}
            ref={c.id === focusId ? focusRef : null}
          >
            <img className="adm__gimg" src={c.image} alt={c.title} loading="lazy" />
            <div className="adm__gbody">
              <div className="adm__gtitle">{c.title}</div>
              <div className="adm__gtags">
                {c.hidden ? (
                  <span className="adm__gtag">hidden</span>
                ) : (
                  <span className={`adm__gtag${c.hires || c.custom ? ' is-hires' : ''}`}>
                    {c.custom ? 'custom' : c.hires ? 'hi-res on file' : 'placeholder'}
                  </span>
                )}
              </div>
              <div className="adm__gactions">
                {c.hidden ? (
                  <button
                    className="adm__chip"
                    disabled={busyId === c.id}
                    onClick={() => restore(c)}
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    <a
                      className="adm__chip"
                      href={c.image}
                      target="_blank"
                      rel="noreferrer"
                      download
                    >
                      Download
                    </a>
                    <label className="adm__chip adm__chip--file">
                      {busyId === c.id
                        ? 'Uploading…'
                        : c.hires || c.custom
                          ? 'Replace'
                          : 'Upload hi-res'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        hidden
                        disabled={busyId === c.id}
                        onChange={(e) => upload(c, e.target.files?.[0])}
                      />
                    </label>
                    {c.hires && !c.custom && (
                      <button
                        className="adm__chip"
                        disabled={busyId === c.id}
                        onClick={() => revert(c)}
                      >
                        Revert
                      </button>
                    )}
                    <button
                      className="adm__chip adm__chip--danger"
                      disabled={busyId === c.id}
                      onClick={() => removeCard(c)}
                    >
                      {c.custom ? 'Delete' : 'Hide'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {!cards.length && <p className="adm__muted">No designs.</p>}
      </div>
    </div>
  )
}
