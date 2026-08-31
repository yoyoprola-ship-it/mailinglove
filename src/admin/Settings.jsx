import { useEffect, useState } from 'react'
import { api } from './api'

const LABELS = {
  photoRedesignEnabled: 'Photo redesign — "Try it now" + old photos',
  postcardDesignEnabled: 'Custom postcard generator',
  imageModel: 'OpenAI image model',
  imageQuality: 'Image quality',
  imageSize: 'Image size (occasions)',
  inputFidelity: 'Input fidelity (face preservation)',
  rateLimitMax: 'Rate limit — requests per window',
  rateLimitWindowMin: 'Rate limit — window (minutes)',
}

const HINTS = {
  photoRedesignEnabled:
    'Off = /api/generate is disabled AND the "Try it now" + "old photos" sections are hidden. For the upload-a-photo redesign.',
  postcardDesignEnabled:
    'Off = /api/postcard-generate is disabled AND the "Generate a personalized postcard" section is hidden. For the name + category generator.',
  imageModel: 'gpt-image-1.5 / gpt-image-1 keep faces faithful; -mini is cheapest but drifts.',
  inputFidelity: '"high" preserves the uploaded face; "off" gives the model free rein.',
  rateLimitWindowMin: 'Takes effect after the next deploy/restart.',
}

const optLabel = (v) => (v === '' ? 'off (disabled)' : v)

export default function Settings() {
  const [fields, setFields] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/api/admin/config')
      .then(({ config, fields }) => {
        setFields(fields)
        setForm(config)
      })
      .catch((e) => setError(e.message))
  }, [])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setMsg('')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const { config } = await api.put('/api/admin/config', form)
      setForm(config)
      setMsg('Saved. Live within ~30 seconds.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !fields) return <p className="adm__error">{error}</p>
  if (!fields) return <p className="adm__muted">Loading…</p>

  return (
    <form className="adm__panel adm__panel--narrow" onSubmit={save}>
      <h2 className="adm__h2">Image generation</h2>

      {Object.entries(fields).map(([key, rule]) => (
        <div className="adm__field" key={key}>
          <label className="adm__label" htmlFor={`f-${key}`}>
            {LABELS[key] || key}
          </label>

          {rule.type === 'bool' && (
            <input
              id={`f-${key}`}
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => set(key, e.target.checked)}
            />
          )}

          {rule.type === 'enum' && (
            <select
              id={`f-${key}`}
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
              id={`f-${key}`}
              className="adm__input"
              type="number"
              min={rule.min}
              max={rule.max}
              value={form[key] ?? ''}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          )}

          {HINTS[key] && <p className="adm__hint">{HINTS[key]}</p>}
        </div>
      ))}

      <button className="adm__btn" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
      {msg && <p className="adm__ok">{msg}</p>}
      {error && <p className="adm__error">{error}</p>}
    </form>
  )
}
