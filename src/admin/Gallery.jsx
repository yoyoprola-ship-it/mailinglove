import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import CropModal from './CropModal'

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
  const [rev, setRev] = useState(0) // bumped after any image change, to bust the <img> cache
  const [cropCard, setCropCard] = useState(null)
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
      setRev((r) => r + 1)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId('')
    }
  }

  async function removeCard(card) {
    if (
      !confirm(
        `Permanently delete “${card.title}”? This removes it from the store and deletes its image for good — this cannot be undone.`
      )
    )
      return
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

  async function toggleHidden(card) {
    setBusyId(card.id)
    setError('')
    try {
      await api.post(`/api/admin/catalog/${card.id}/hidden`, { hidden: !card.hidden })
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
        Add designs, crop or replace an image (it takes over everywhere at
        once), hide one from the store, or delete it for good.
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
            <img
              className="adm__gimg"
              src={`${c.image}&r=${rev}`}
              alt={c.title}
              loading="lazy"
            />
            <div className="adm__gbody">
              <div className="adm__gtitle">{c.title}</div>
              {c.hidden && (
                <div className="adm__gtags">
                  <span className="adm__gtag">hidden</span>
                </div>
              )}
              <div className="adm__gactions">
                <a
                  className="adm__chip"
                  href={`${c.image}&download=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
                <label className="adm__chip adm__chip--file">
                  {busyId === c.id ? 'Uploading…' : 'Replace'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={busyId === c.id}
                    onChange={(e) => upload(c, e.target.files?.[0])}
                  />
                </label>
                <button
                  className="adm__chip"
                  disabled={busyId === c.id}
                  onClick={() => setCropCard(c)}
                >
                  Crop
                </button>
                <button
                  className="adm__chip"
                  disabled={busyId === c.id}
                  onClick={() => toggleHidden(c)}
                >
                  {c.hidden ? 'Show' : 'Hide'}
                </button>
                <button
                  className="adm__chip adm__chip--danger"
                  disabled={busyId === c.id}
                  onClick={() => removeCard(c)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!cards.length && <p className="adm__muted">No designs.</p>}
      </div>

      {cropCard && (
        <CropModal
          card={{ ...cropCard, image: `${cropCard.image}&r=${rev}` }}
          onClose={() => setCropCard(null)}
          onDone={async () => {
            setCropCard(null)
            setRev((r) => r + 1)
            await load()
          }}
        />
      )}
    </div>
  )
}
