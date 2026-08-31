import { useRef, useState } from 'react'
import Icon from './Icon'

// Shared upload -> /api/generate -> result widget. Both the "occasions" and the
// "modernize old photos" sections render this with different option lists and copy.
export default function PhotoStudio({
  options,
  selectLabel,
  submitIdle,
  submitBusy,
  resultIcon = 'sparkles',
  placeholder,
}) {
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [category, setCategory] = useState(options[0].value)
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult('')
    setStatus('idle')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Add a photo first.')
      return
    }
    setStatus('working')
    setError('')
    setResult('')
    try {
      const body = new FormData()
      body.append('photo', file)
      body.append('category', category)
      const res = await fetch('/api/generate', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setResult(data.image)
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <form className="studio" onSubmit={handleSubmit}>
      <div className="studio__panel">
        <button
          type="button"
          className="studio__drop"
          onClick={() => fileInput.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Your upload" className="studio__img" />
          ) : (
            <span className="studio__drop-hint">
              <Icon name="upload" size={26} />
              Choose a photo
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={pickFile}
        />

        <div className="studio__controls">
          <label className="studio__label" htmlFor="studio-category">
            {selectLabel}
          </label>
          <select
            id="studio-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" type="submit" disabled={status === 'working'}>
            {status === 'working' ? submitBusy : submitIdle}
          </button>
          {status === 'working' && (
            <p className="studio__note">This takes 15–30 seconds.</p>
          )}
          {error && <p className="studio__error">{error}</p>}
        </div>
      </div>

      <div className="studio__panel studio__panel--result">
        {result ? (
          <>
            <img src={result} alt="Result" className="studio__img" />
            <div className="studio__result-actions">
              <a className="btn btn--ghost btn--sm" href={result} download="mailinglove.jpg">
                Download
              </a>
              <a className="btn btn--primary btn--sm" href="#waitlist">
                Like it? Join the waitlist
              </a>
            </div>
          </>
        ) : (
          <span className="studio__placeholder">
            <Icon name={resultIcon} size={26} />
            {placeholder}
          </span>
        )}
      </div>
    </form>
  )
}
