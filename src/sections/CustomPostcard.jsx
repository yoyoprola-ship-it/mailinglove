import { useEffect, useMemo, useState } from 'react'
import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import catalog from '../data/postcards.json'

const FALLBACK_SIZES = [
  { id: '4x6', label: '4×6 in — vertical' },
  { id: '6x4', label: '6×4 in — horizontal' },
  { id: '4x4', label: '4×4 in — square' },
]

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`

export default function CustomPostcard({
  sizes,
  priceCents = 0,
  signedIn,
  onAdded,
  onRequireAuth,
}) {
  const SIZES = useMemo(() => (sizes && sizes.length ? sizes : FALLBACK_SIZES), [sizes])
  const [name, setName] = useState('')
  const [category, setCategory] = useState(catalog.types[0].id)
  const [subcategory, setSubcategory] = useState('')
  const [size, setSize] = useState(SIZES[0].id)
  const [message, setMessage] = useState('')
  const [background, setBackground] = useState('')
  const [status, setStatus] = useState('idle') // idle | working | done | error
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [cartState, setCartState] = useState('idle') // idle | adding | done
  const [cartError, setCartError] = useState('')

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
      body.append('image', blob, 'custom-postcard.png')
      body.append('size', size)
      body.append('width', String(dims.w))
      body.append('height', String(dims.h))
      const res = await fetch('/api/cart/custom-postcard', {
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

  const subs = useMemo(
    () => catalog.types.find((t) => t.id === category)?.subcategories || [],
    [category]
  )

  // Keep the selected size valid if the admin's list loads/changes.
  useEffect(() => {
    if (!SIZES.some((s) => s.id === size)) setSize(SIZES[0].id)
  }, [SIZES, size])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Add the name first.')
      return
    }
    setStatus('working')
    setError('')
    setResult('')
    try {
      const res = await fetch('/api/postcard-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          subcategory: subcategory || undefined,
          size,
          message: message.trim() || undefined,
          background: background.trim() || undefined,
        }),
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

  return (
    <section className="section section--dark" id="custom-postcard">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Make your own</p>
          <h2 className="section__title section__title--light">
            Generate a personalized postcard
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead section__lead--light">
            Give us a name and an occasion — AI designs a one-of-a-kind postcard.
            Add your own message and background, or leave them to us.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <form className="studio" onSubmit={handleSubmit}>
            <div className="studio__panel cpc__form">
              <label className="studio__label" htmlFor="cpc-name">
                Name on the postcard
              </label>
              <input
                id="cpc-name"
                className="cpc__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="e.g. Grandma Rose"
              />

              <div className="cpc__row">
                <div>
                  <label className="studio__label" htmlFor="cpc-cat">
                    Category
                  </label>
                  <select
                    id="cpc-cat"
                    className="cpc__input"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value)
                      setSubcategory('')
                    }}
                  >
                    {catalog.types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {subs.length > 0 && (
                  <div>
                    <label className="studio__label" htmlFor="cpc-sub">
                      Recipient
                    </label>
                    <select
                      id="cpc-sub"
                      className="cpc__input"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                    >
                      <option value="">Anyone</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label className="studio__label">Size (fits a standard #10 envelope)</label>
              <div className="cpc__sizes">
                {SIZES.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`cpc__size${size === s.id ? ' is-active' : ''}`}
                    onClick={() => setSize(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <label className="studio__label" htmlFor="cpc-msg">
                Message <span className="cpc__opt">(optional — blank = AI writes one)</span>
              </label>
              <textarea
                id="cpc-msg"
                className="cpc__input cpc__textarea"
                rows={2}
                maxLength={250}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <label className="studio__label" htmlFor="cpc-bg">
                Background / style <span className="cpc__opt">(optional)</span>
              </label>
              <input
                id="cpc-bg"
                className="cpc__input"
                maxLength={160}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="e.g. watercolor peonies, starry night, minimalist gold"
              />

              <button
                className="btn btn--primary"
                type="submit"
                disabled={status === 'working'}
              >
                {status === 'working' ? 'Generating…' : 'Generate my postcard'}
              </button>
              {status === 'working' && (
                <p className="studio__note">This takes 15–30 seconds.</p>
              )}
              {error && <p className="studio__error">{error}</p>}
            </div>

            <div className="studio__panel studio__panel--result">
              {result ? (
                <>
                  <img src={result} alt="Your postcard" className="studio__img" />
                  <div className="studio__result-actions">
                    <a
                      className="btn btn--ghost btn--sm"
                      href={result}
                      download="mailinglove-postcard.png"
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
                          : !signedIn
                            ? 'Sign in to add to cart'
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
                  Generating your postcard…
                </span>
              ) : (
                <span className="studio__placeholder">
                  <Icon name="sparkles" size={26} />
                  Your postcard shows up here
                </span>
              )}
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  )
}
