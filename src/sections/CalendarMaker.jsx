import { useEffect, useRef, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import CropModal from '../components/CropModal'

const MAX = 4
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
let uid = 0

export default function CalendarMaker({
  year = 2027,
  priceCents = 0,
  signedIn,
  onAdded,
  onRequireAuth,
}) {
  const [photos, setPhotos] = useState([]) // { id, file, url }
  const [scene, setScene] = useState('')
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [cartState, setCartState] = useState('idle') // idle | adding | done
  const [cartError, setCartError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [cropId, setCropId] = useState(null)
  const fileRef = useRef(null)
  const photosRef = useRef(photos)
  photosRef.current = photos

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  function addFiles(list) {
    const incoming = [...(list || [])].filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    setError('')
    setPhotos((cur) => {
      const room = MAX - cur.length
      const add = incoming.slice(0, room).map((f) => ({
        id: `c${++uid}`,
        file: f,
        url: URL.createObjectURL(f),
      }))
      return [...cur, ...add]
    })
  }

  function removePhoto(id) {
    setPhotos((cur) => {
      const gone = cur.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return cur.filter((p) => p.id !== id)
    })
  }

  function replacePhoto(id, blob) {
    const url = URL.createObjectURL(blob)
    setPhotos((cur) =>
      cur.map((p) => {
        if (p.id !== id) return p
        URL.revokeObjectURL(p.url)
        return { ...p, file: blob, url }
      })
    )
  }

  const cropTarget = photos.find((p) => p.id === cropId) || null

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer?.files)
  }

  async function generate() {
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    if (!photos.length) {
      setError('Add at least one photo.')
      return
    }
    setStatus('working')
    setError('')
    setResult('')
    try {
      const body = new FormData()
      photos.forEach((p) => body.append('photos', p.file))
      if (scene.trim()) body.append('scene', scene.trim())
      const res = await fetch('/api/calendar-generate', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setResult(data.image)
      setStatus('done')
      setCartState('idle')
      setCartError('')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  async function addToCart() {
    if (!result) return
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    setCartState('adding')
    setCartError('')
    try {
      const blob = await (await fetch(result)).blob()
      const dims = await new Promise((resolve) => {
        const im = new Image()
        im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight })
        im.onerror = () => resolve({ w: 0, h: 0 })
        im.src = result
      })
      const body = new FormData()
      body.append('image', blob, 'calendar.png')
      body.append('width', String(dims.w))
      body.append('height', String(dims.h))
      const res = await fetch('/api/cart/calendar', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not add to cart.')
      setCartState('done')
      onAdded?.(d.items)
    } catch (err) {
      setCartError(err.message)
      setCartState('idle')
    }
  }

  return (
    <section className="section section--dark" id="calendar">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Make your own</p>
          <h2 className="section__title section__title--light">Design a {year} photo calendar</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead section__lead--light">
            Add your photos and describe the world you want them in — a field of
            wildflowers, a galaxy, a children&rsquo;s park. AI builds a creative
            8×10&nbsp;in wall calendar with all twelve months of {year}, your photos
            framed into the artwork. Printed and mailed like everything else.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="studio">
            <div className="studio__panel cpc__form">
              <label className="studio__label">
                Your photos <span className="cpc__opt">(1–{MAX} — each gets framed into the design)</span>
              </label>

              <div
                className={`cal__drop${dragOver ? ' is-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {photos.length === 0 ? (
                  <button
                    type="button"
                    className="cal__drop-cta"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="upload" size={30} />
                    <strong>Upload your photos</strong>
                    <span>Drag them here, or click to choose · JPG or PNG · up to {MAX}</span>
                  </button>
                ) : (
                  <div className="cal__grid">
                    {photos.map((p) => (
                      <div className="cal__thumb" key={p.id}>
                        <img src={p.url} alt="" />
                        <button
                          type="button"
                          className="cal__thumb-x"
                          onClick={() => removePhoto(p.id)}
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          className="cal__thumb-edit"
                          onClick={() => setCropId(p.id)}
                        >
                          Adjust
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX && (
                      <button
                        type="button"
                        className="cal__thumb cal__thumb--add"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Icon name="upload" size={20} />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />

              <label className="studio__label" htmlFor="cal-scene">
                Scene / atmosphere <span className="cpc__opt">(optional — AI picks one if blank)</span>
              </label>
              <input
                id="cal-scene"
                className="cpc__input"
                maxLength={120}
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                placeholder="e.g. a field of wildflowers, a starry galaxy, a children's park"
              />

              <button
                className="btn btn--primary"
                type="button"
                onClick={generate}
                disabled={status === 'working'}
              >
                {status === 'working'
                  ? 'Generating…'
                  : signedIn
                    ? `Generate my ${year} calendar`
                    : 'Sign in to generate'}
              </button>
              {status === 'working' && <p className="studio__note">This takes 20–40 seconds.</p>}
              {error && <p className="studio__error">{error}</p>}
            </div>

            <div className="studio__panel studio__panel--result">
              {result ? (
                <>
                  <img src={result} alt={`${year} calendar`} className="studio__img" />
                  <div className="studio__result-actions">
                    <a
                      className="btn btn--ghost btn--sm"
                      href={result}
                      download={`mailinglove-${year}-calendar.png`}
                    >
                      Download
                    </a>
                    {cartState === 'done' ? (
                      <a className="btn btn--primary btn--sm" href="/account?tab=cart">
                        In your cart · view
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={addToCart}
                        disabled={cartState === 'adding'}
                      >
                        {cartState === 'adding'
                          ? 'Adding…'
                          : priceCents > 0
                            ? `Add to cart · ${money(priceCents)}`
                            : 'Add to cart'}
                      </button>
                    )}
                  </div>
                  {cartError && <p className="studio__error">{cartError}</p>}
                </>
              ) : status === 'working' ? (
                <span className="studio__placeholder">
                  <span className="spinner" />
                  Generating your calendar…
                </span>
              ) : (
                <span className="studio__placeholder">
                  <Icon name="calendar" size={26} />
                  Your calendar shows up here
                </span>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {cropTarget && (
        <CropModal
          src={cropTarget.url}
          title="Adjust photo — frame it how you want"
          onCancel={() => setCropId(null)}
          onApply={async (blob) => {
            replacePhoto(cropTarget.id, blob)
            setCropId(null)
          }}
        />
      )}
    </section>
  )
}
