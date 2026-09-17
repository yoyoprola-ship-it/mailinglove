import { useEffect, useState } from 'react'
import { api } from './api'
import CropModal from '../components/CropModal'

const MOUNT_LABELS = { wall: 'Wall hanging', stand: 'Tabletop stand' }
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`

function NewFrameForm({ ratios, mounts, onAdded }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [ratioId, setRatioId] = useState(ratios[0]?.id || '')
  const [picked, setPicked] = useState([])
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggleMount(m) {
    setPicked((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Name is required.')
    const priceCents = Math.round(Number(price))
    if (!Number.isFinite(priceCents) || priceCents <= 0) return setError('Set a price greater than $0.')
    const costCents = cost === '' ? 0 : Math.round(Number(cost))
    if (!Number.isFinite(costCents) || costCents < 0) return setError('Cost must be $0 or more.')
    if (!picked.length) return setError('Pick at least one mount option.')
    if (!files.length) return setError('Add at least one photo of this frame.')

    setBusy(true)
    try {
      const body = new FormData()
      body.append('name', name.trim())
      body.append('priceCents', String(priceCents))
      body.append('costCents', String(costCents))
      body.append('mounts', picked.join(','))
      body.append('ratioId', ratioId)
      files.forEach((f) => body.append('images', f))
      const res = await fetch('/api/admin/frames', { method: 'POST', credentials: 'same-origin', body })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add the frame.')
      setName('')
      setPrice('')
      setCost('')
      setPicked([])
      setFiles([])
      onAdded(d.frame)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="adm__panel adm__panel--narrow" onSubmit={submit}>
      <h2 className="adm__h2">Add a frame</h2>

      <div className="adm__field">
        <label className="adm__label">Name</label>
        <input
          className="adm__input"
          placeholder="Oak wall frame"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="adm__field">
        <label className="adm__label">Sale price (USD cents, e.g. 2999 = $29.99)</label>
        <input
          className="adm__input adm__input--sm"
          type="number"
          min={1}
          max={100000}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <p className="adm__hint">What the customer pays — includes the frame, the print, and shipping.</p>
      </div>

      <div className="adm__field">
        <label className="adm__label">Purchase cost (USD cents, optional)</label>
        <input
          className="adm__input adm__input--sm"
          type="number"
          min={0}
          max={100000}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <p className="adm__hint">What the frame costs you to buy — for your own records, never shown to customers.</p>
      </div>

      <div className="adm__field">
        <label className="adm__label">Photo opening</label>
        <select className="adm__input" value={ratioId} onChange={(e) => setRatioId(e.target.value)}>
          {ratios.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="adm__field">
        <label className="adm__label">Mount options</label>
        <div className="adm__chips">
          {mounts.map((m) => (
            <button
              key={m}
              type="button"
              className={`adm__chip${picked.includes(m) ? ' is-active' : ''}`}
              onClick={() => toggleMount(m)}
            >
              {MOUNT_LABELS[m] || m}
            </button>
          ))}
        </div>
      </div>

      <div className="adm__field">
        <label className="adm__label">Photos of this frame (shown to customers)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles([...(e.target.files || [])])}
        />
        {files.length > 0 && <p className="adm__hint">{files.length} photo(s) selected.</p>}
      </div>

      {error && <p className="adm__error">{error}</p>}

      <button className="adm__btn" type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add frame'}
      </button>
    </form>
  )
}

function FrameImages({ frame, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cropping, setCropping] = useState(false)

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      files.forEach((f) => body.append('images', f))
      const res = await fetch(`/api/admin/frames/${frame.id}/images`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add the photos.')
      onChanged(d.frame)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(imageId) {
    if (frame.images.length <= 1) {
      setError('A frame needs at least one photo.')
      return
    }
    if (!confirm('Remove this photo?')) return
    setBusy(true)
    setError('')
    try {
      const { frame: fresh } = await api.delete(`/api/admin/frames/${frame.id}/images/${imageId}`)
      onChanged(fresh)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function applyCoverCrop(blob) {
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('image', blob, 'cover.jpg')
      const res = await fetch(`/api/admin/frames/${frame.id}/cover`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save the crop.')
      onChanged(d.frame)
      setCropping(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const cover = frame.images[0]

  return (
    <div className="adm__field">
      <label className="adm__label">Photos ({frame.images.length}/8)</label>
      <p className="adm__hint">
        The first photo is the cover shown on the shop grid — crop it to fit; the full
        photos (including this one) only show once a customer opens the frame.
      </p>
      <div className="adm__gallery">
        {frame.images.map((img, i) => (
          <div className="adm__gcard" key={img.id}>
            <img className="adm__gimg" src={img.thumb} alt="" loading="lazy" />
            <div className="adm__gbody">
              {i === 0 && (
                <div className="adm__gtags">
                  <span className="adm__gtag">cover</span>
                </div>
              )}
              <div className="adm__gactions">
                {i === 0 && (
                  <button
                    type="button"
                    className="adm__chip"
                    disabled={busy}
                    onClick={() => setCropping(true)}
                  >
                    Crop cover
                  </button>
                )}
                <button
                  type="button"
                  className="adm__chip adm__chip--danger"
                  disabled={busy}
                  onClick={() => removeImage(img.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {frame.images.length < 8 && (
        <label className="adm__btn adm__chip--file" style={{ display: 'inline-block' }}>
          {busy ? 'Uploading…' : '＋ Add photos'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
      {error && <p className="adm__error">{error}</p>}

      {cropping && (
        <CropModal
          src={cover.image}
          title="Crop the cover photo"
          aspect={4 / 5}
          onCancel={() => setCropping(false)}
          onApply={applyCoverCrop}
        />
      )}
    </div>
  )
}

function FrameCard({ frame, ratios, mounts, onChanged, onRemoved }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: frame.name,
    priceCents: frame.priceCents,
    costCents: frame.costCents || 0,
    mounts: frame.mounts,
    ratioId: frame.ratioId,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const dirty =
    form.name !== frame.name ||
    form.priceCents !== frame.priceCents ||
    form.costCents !== (frame.costCents || 0) ||
    form.ratioId !== frame.ratioId ||
    form.mounts.join(',') !== frame.mounts.join(',')

  function toggleMount(m) {
    setForm((f) => ({
      ...f,
      mounts: f.mounts.includes(m) ? f.mounts.filter((x) => x !== m) : [...f.mounts, m],
    }))
    setMsg('')
  }

  async function save() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const { frame: fresh } = await api.post(`/api/admin/frames/${frame.id}`, form)
      onChanged(fresh)
      setMsg('Saved.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleHidden() {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/admin/frames/${frame.id}/hidden`, { hidden: !frame.hidden })
      onChanged({ ...frame, hidden: !frame.hidden })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Permanently delete "${frame.name}"? This cannot be undone.`)) return
    setBusy(true)
    setError('')
    try {
      await api.delete(`/api/admin/frames/${frame.id}`)
      onRemoved(frame.id)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const ratioLabel = ratios.find((r) => r.id === frame.ratioId)?.label || frame.ratioId
  const mountLabel = frame.mounts.map((m) => MOUNT_LABELS[m] || m).join(', ')
  const cost = frame.costCents || 0
  const margin = frame.priceCents - cost
  const noCost = cost === 0

  return (
    <div className={`adm__fr-row${frame.hidden ? ' is-hidden' : ''}`}>
      <button type="button" className="adm__fr-summary" onClick={() => setOpen((v) => !v)}>
        <span className="adm__chevron">{open ? '▾' : '▸'}</span>
        <img className="adm__fr-thumb" src={frame.thumb} alt="" loading="lazy" />
        <span className="adm__fr-info">
          <strong className="adm__fr-name">{frame.name}</strong>
          <span className="adm__muted adm__fr-meta">
            Venta {money(frame.priceCents)}
            {!noCost && ` · Costo ${money(cost)} · Margen ${money(margin)}`}
            {noCost && ' · sin costo registrado'}
            {' · '}
            {ratioLabel} · {mountLabel}
            {frame.hidden && ' · hidden'}
          </span>
        </span>
      </button>

      {open && (
        <div className="adm__fr-body">
          <div className="adm__field">
            <label className="adm__label">Name</label>
            <input
              className="adm__input"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                setMsg('')
              }}
            />
          </div>

          <div className="adm__field">
            <label className="adm__label">Sale price (USD cents)</label>
            <input
              className="adm__input adm__input--sm"
              type="number"
              min={1}
              max={100000}
              value={form.priceCents}
              onChange={(e) => {
                setForm((f) => ({ ...f, priceCents: Number(e.target.value) }))
                setMsg('')
              }}
            />
            <span className="adm__muted"> {money(form.priceCents)}</span>
          </div>

          <div className="adm__field">
            <label className="adm__label">Purchase cost (USD cents)</label>
            <input
              className="adm__input adm__input--sm"
              type="number"
              min={0}
              max={100000}
              value={form.costCents}
              onChange={(e) => {
                setForm((f) => ({ ...f, costCents: Number(e.target.value) }))
                setMsg('')
              }}
            />
            <span className="adm__muted">
              {' '}
              {money(form.costCents)} · Margin {money(form.priceCents - form.costCents)}
            </span>
          </div>

          <div className="adm__field">
            <label className="adm__label">Photo opening</label>
            <select
              className="adm__input"
              value={form.ratioId}
              onChange={(e) => {
                setForm((f) => ({ ...f, ratioId: e.target.value }))
                setMsg('')
              }}
            >
              {ratios.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="adm__field">
            <label className="adm__label">Mount options</label>
            <div className="adm__chips">
              {mounts.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`adm__chip${form.mounts.includes(m) ? ' is-active' : ''}`}
                  onClick={() => toggleMount(m)}
                >
                  {MOUNT_LABELS[m] || m}
                </button>
              ))}
            </div>
          </div>

          <FrameImages frame={frame} onChanged={onChanged} />

          {error && <p className="adm__error">{error}</p>}
          {msg && !dirty && <p className="adm__ok">{msg}</p>}

          <div className="adm__gactions">
            <button className="adm__btn" type="button" disabled={busy || !dirty} onClick={save}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button className="adm__chip" type="button" disabled={busy} onClick={toggleHidden}>
              {frame.hidden ? 'Show' : 'Hide'}
            </button>
            <button className="adm__chip adm__chip--danger" type="button" disabled={busy} onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Frames() {
  const [rows, setRows] = useState(null)
  const [ratios, setRatios] = useState([])
  const [mounts, setMounts] = useState([])
  const [error, setError] = useState('')

  async function load() {
    try {
      const { frames, ratios, mounts } = await api.get('/api/admin/frames')
      setRows(frames)
      setRatios(ratios)
      setMounts(mounts)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function onAdded(frame) {
    setRows((list) => [...(list || []), frame])
  }
  function onChanged(frame) {
    setRows((list) => list.map((f) => (f.id === frame.id ? { ...f, ...frame } : f)))
  }
  function onRemoved(id) {
    setRows((list) => list.filter((f) => f.id !== id))
  }

  if (error && !rows) return <p className="adm__error">{error}</p>
  if (!rows) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panels">
      <p className="adm__muted adm__hint--top">
        Frames are their own shop page. Turn the section on for visitors under
        Settings → Photo frames once you have real products here.
      </p>

      <NewFrameForm ratios={ratios} mounts={mounts} onAdded={onAdded} />

      <div className="adm__panel">
        <h2 className="adm__h2">Your frames ({rows.length})</h2>
        {rows.length === 0 && <p className="adm__muted">No frames yet — add one above.</p>}
        {rows.map((f) => (
          <FrameCard key={f.id} frame={f} ratios={ratios} mounts={mounts} onChanged={onChanged} onRemoved={onRemoved} />
        ))}
      </div>
    </div>
  )
}
