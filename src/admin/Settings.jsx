import { useEffect, useState } from 'react'
import { api } from './api'

const optLabel = (v) => (v === '' ? 'off (disabled)' : v)

function SizesEditor({ value, apiValues, onChange }) {
  const rows = Array.isArray(value) ? value : []
  const setRow = (i, patch) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, j) => j !== i))
  const add = () =>
    onChange([...rows, { id: '', label: '', api: apiValues[0], priceCents: 0 }])

  return (
    <div className="adm__sizes">
      {rows.map((r, i) => (
        <div className="adm__size-row" key={i}>
          <input
            className="adm__input adm__input--sm"
            placeholder="id"
            value={r.id}
            onChange={(e) => setRow(i, { id: e.target.value })}
          />
          <input
            className="adm__input"
            placeholder="Label shown to visitors"
            value={r.label}
            onChange={(e) => setRow(i, { label: e.target.value })}
          />
          <select
            className="adm__input adm__input--sm"
            value={r.api}
            onChange={(e) => setRow(i, { api: e.target.value })}
          >
            {apiValues.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            className="adm__input adm__input--sm"
            type="number"
            min={0}
            max={100000}
            placeholder="¢"
            value={r.priceCents ?? 0}
            onChange={(e) => setRow(i, { priceCents: Number(e.target.value) })}
          />
          <button type="button" className="adm__chip" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="adm__chip" onClick={add}>
        + Add format
      </button>
      <p className="adm__hint">
        id: short slug (a–z, 0–9, -). api: the gpt-image output size. Price is in
        cents (299 = $2.99); 0 falls back to the flat postcard price. Order here is
        the order shown on the site.
      </p>
    </div>
  )
}

function PriceFormatsEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : []
  const setRow = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, j) => j !== i))
  const add = () => onChange([...rows, { id: '', label: '', w: 4, h: 6, priceCents: 199 }])

  return (
    <div className="adm__sizes">
      <div className="adm__pf-head">
        <span>id</span>
        <span>Label</span>
        <span>W in</span>
        <span>H in</span>
        <span>Price ¢</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div className="adm__pf-row" key={i}>
          <input
            className="adm__input adm__input--sm"
            placeholder="4x6"
            value={r.id}
            onChange={(e) => setRow(i, { id: e.target.value })}
          />
          <input
            className="adm__input"
            placeholder="4×6 in"
            value={r.label}
            onChange={(e) => setRow(i, { label: e.target.value })}
          />
          <input
            className="adm__input adm__input--sm"
            type="number"
            min={0.5}
            max={48}
            step={0.5}
            value={r.w}
            onChange={(e) => setRow(i, { w: Number(e.target.value) })}
          />
          <input
            className="adm__input adm__input--sm"
            type="number"
            min={0.5}
            max={48}
            step={0.5}
            value={r.h}
            onChange={(e) => setRow(i, { h: Number(e.target.value) })}
          />
          <input
            className="adm__input adm__input--sm"
            type="number"
            min={0}
            max={100000}
            value={r.priceCents}
            onChange={(e) => setRow(i, { priceCents: Number(e.target.value) })}
          />
          <button type="button" className="adm__chip" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="adm__chip" onClick={add}>
        + Add format
      </button>
      <p className="adm__hint">
        W/H are inches — they set the crop shape and the 300 DPI print target.
        Price is in cents (199 = $1.99). Order here is the order shown on the site.
      </p>
    </div>
  )
}

function Panel({ id, group, config, onSaved }) {
  const [form, setForm] = useState(config)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const { config: fresh } = await api.put('/api/admin/config', { [id]: form })
      setForm(fresh[id])
      onSaved(fresh)
      setMsg('Saved. Live within ~30 s.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="adm__panel adm__panel--narrow" onSubmit={save}>
      <h2 className="adm__h2">{group.label}</h2>
      {group.hint && <p className="adm__hint adm__hint--top">{group.hint}</p>}

      {Object.entries(group.fields).map(([key, rule]) => (
        <div className="adm__field" key={key}>
          <label className="adm__label" htmlFor={`${id}-${key}`}>
            {rule.label || key}
          </label>

          {rule.type === 'bool' && (
            <input
              id={`${id}-${key}`}
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => set(key, e.target.checked)}
            />
          )}

          {rule.type === 'enum' && (
            <select
              id={`${id}-${key}`}
              className="adm__input"
              value={form[key] ?? ''}
              onChange={(e) => set(key, e.target.value)}
            >
              {rule.values.map((v) => (
                <option key={v} value={v}>
                  {optLabel(v)}
                </option>
              ))}
            </select>
          )}

          {rule.type === 'int' && (
            <input
              id={`${id}-${key}`}
              className="adm__input"
              type="number"
              min={rule.min}
              max={rule.max}
              value={form[key] ?? ''}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          )}

          {rule.type === 'zip' && (
            <input
              id={`${id}-${key}`}
              className="adm__input adm__input--sm"
              inputMode="numeric"
              maxLength={5}
              placeholder="90210"
              value={form[key] ?? ''}
              onChange={(e) => set(key, e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          )}

          {rule.type === 'sizes' && (
            <SizesEditor
              value={form[key]}
              apiValues={rule.apiValues}
              onChange={(v) => set(key, v)}
            />
          )}

          {rule.type === 'priceformats' && (
            <PriceFormatsEditor value={form[key]} onChange={(v) => set(key, v)} />
          )}
        </div>
      ))}

      <button className="adm__btn" type="submit" disabled={busy}>
        {busy ? 'Saving…' : `Save ${group.label.toLowerCase()}`}
      </button>
      {msg && <p className="adm__ok">{msg}</p>}
      {error && <p className="adm__error">{error}</p>}
    </form>
  )
}

export default function Settings() {
  const [schema, setSchema] = useState(null)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/admin/config')
      .then(({ config, schema }) => {
        setSchema(schema)
        setConfig(config)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error && !schema) return <p className="adm__error">{error}</p>
  if (!schema) return <p className="adm__muted">Loading…</p>

  return (
    <div className="adm__panels">
      {Object.entries(schema).map(([id, group]) => (
        <Panel
          key={id}
          id={id}
          group={group}
          config={config[id]}
          onSaved={setConfig}
        />
      ))}
    </div>
  )
}
