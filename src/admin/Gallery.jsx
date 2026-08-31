import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'

export default function Gallery({ focusId, onFocusHandled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [type, setType] = useState('birthday')
  const [sub, setSub] = useState(null)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState('')
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

  if (error && !data) return <p className="adm__error">{error}</p>
  if (!data) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panel">
      <h2 className="adm__h2">Postcard library</h2>
      <p className="adm__muted adm__hint--top">
        Download a design to print, or upload a higher-quality file to replace it everywhere.
      </p>

      <input
        className="adm__input"
        placeholder="Search by title or id…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
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
            className={`adm__gcard${c.id === focusId ? ' is-focus' : ''}`}
            key={c.id}
            ref={c.id === focusId ? focusRef : null}
          >
            <img className="adm__gimg" src={c.image} alt={c.title} loading="lazy" />
            <div className="adm__gbody">
              <div className="adm__gtitle">{c.title}</div>
              <span className={`adm__gtag${c.hires ? ' is-hires' : ''}`}>
                {c.hires ? 'hi-res on file' : 'placeholder'}
              </span>
              <div className="adm__gactions">
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
                  {busyId === c.id ? 'Uploading…' : c.hires ? 'Replace' : 'Upload hi-res'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    hidden
                    disabled={busyId === c.id}
                    onChange={(e) => upload(c, e.target.files?.[0])}
                  />
                </label>
                {c.hires && (
                  <button
                    className="adm__chip"
                    disabled={busyId === c.id}
                    onClick={() => revert(c)}
                  >
                    Revert
                  </button>
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
