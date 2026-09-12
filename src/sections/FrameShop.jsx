import { useEffect, useMemo, useState } from 'react'
import Reveal from '../components/Reveal'
import CropModal from '../components/CropModal'
import { mpTrack } from '../metaPixel'
import { trackEvent } from '../track'

const money = (c) => `$${((c || 0) / 100).toFixed(2)}`
const MOUNT_LABELS = { wall: 'Wall hanging', stand: 'Tabletop stand' }

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Could not read an image.'))
    im.src = src
  })
}

// A frame's gallery — the photos the admin uploaded of the frame itself
// (on a wall, on a shelf, …), swipeable with dots.
function Gallery({ images }) {
  const [i, setI] = useState(0)
  const n = images.length
  const go = (d) => setI((v) => (v + d + n) % n)
  return (
    <div className="fr-gallery">
      <div className="fr-gallery__stage">
        <img className="fr-gallery__img" src={images[i]?.image} alt="" />
        {n > 1 && (
          <>
            <button type="button" className="fr-gallery__nav fr-gallery__nav--prev" onClick={() => go(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className="fr-gallery__nav fr-gallery__nav--next" onClick={() => go(1)} aria-label="Next photo">
              ›
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="fr-gallery__dots">
          {images.map((_, d) => (
            <button
              key={d}
              type="button"
              className={`fr-gallery__dot${d === i ? ' is-active' : ''}`}
              onClick={() => setI(d)}
              aria-label={`Photo ${d + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FrameModal({ frame, signedIn, onClose, onRequireAuth, onAdded }) {
  const [mount, setMount] = useState(frame.mounts[0] || '')
  const [step, setStep] = useState('gallery') // gallery | crop
  const [photoUrl, setPhotoUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ratio = frame.ratioW / frame.ratioH

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && step === 'gallery') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [step, onClose])

  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl])

  function startAdd() {
    if (!signedIn) {
      onRequireAuth?.()
      return
    }
    setError('')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      setPhotoUrl(url)
      setStep('crop')
    }
    input.click()
  }

  async function applyCrop(blob) {
    setBusy(true)
    setError('')
    try {
      const cropUrl = URL.createObjectURL(blob)
      const im = await loadImg(cropUrl).finally(() => URL.revokeObjectURL(cropUrl))
      const outW = Math.max(600, Math.min(Math.round(frame.ratioW * 300), 3000))
      const outH = Math.round(outW / ratio)
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, outW, outH)
      const finalBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95))
      if (!finalBlob) throw new Error('Could not render the print.')

      const body = new FormData()
      body.append('image', finalBlob, 'frame.jpg')
      body.append('frameId', frame.id)
      body.append('mount', mount)
      body.append('width', String(outW))
      body.append('height', String(outH))
      const r = await fetch('/api/cart/frame', { method: 'POST', credentials: 'same-origin', body })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not add to cart.')

      mpTrack('AddToCart', {
        content_type: 'product',
        content_ids: [frame.id],
        content_name: frame.name,
        value: frame.priceCents / 100,
        currency: 'USD',
      })
      trackEvent('add_to_cart', { valueCents: frame.priceCents })
      onAdded?.(d.items)
      onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="fr-modal" onClick={busy ? undefined : onClose} role="dialog" aria-modal="true" aria-label={frame.name}>
      <div className="fr-modal__box" onClick={(e) => e.stopPropagation()}>
        {step === 'gallery' && (
          <>
            <button className="fr-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
            <Gallery images={frame.images} />
            <div className="fr-modal__body">
              <h3 className="fr-modal__name">{frame.name}</h3>
              <p className="fr-modal__price">{money(frame.priceCents)} — frame, print &amp; shipping included</p>

              {frame.mounts.length > 1 && (
                <div className="fr-mounts">
                  {frame.mounts.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`fr-mount${mount === m ? ' is-active' : ''}`}
                      onClick={() => setMount(m)}
                    >
                      {MOUNT_LABELS[m] || m}
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="fr-error">{error}</p>}

              <button type="button" className="btn btn--primary fr-modal__cta" onClick={startAdd} disabled={busy}>
                {signedIn ? 'Choose your photo' : 'Sign in to add to cart'}
              </button>
              <p className="fr-hint">
                You'll pick and crop the photo that goes inside next.
              </p>
            </div>
          </>
        )}

        {step === 'crop' && photoUrl && (
          <CropModal
            src={photoUrl}
            title={`Crop your photo to fit — ${frame.ratioW}×${frame.ratioH} in`}
            aspect={ratio}
            onCancel={() => setStep('gallery')}
            onApply={applyCrop}
          />
        )}
      </div>
    </div>
  )
}

export default function FrameShop({ signedIn, onAdded, onRequireAuth }) {
  const [frames, setFrames] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    fetch('/api/frames')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.frames)) setFrames(d.frames)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const cards = useMemo(() => frames, [frames])

  if (loaded && !cards.length) {
    return (
      <section className="section" id="frames">
        <div className="section-inner">
          <Reveal>
            <p className="eyebrow">Photo frames</p>
            <h2 className="section__title">Frames aren't available right now</h2>
            <p className="section__lead">Check back soon.</p>
          </Reveal>
        </div>
      </section>
    )
  }

  return (
    <section className="section" id="frames">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Photo frames</p>
          <h2 className="section__title">Frame one of your photos</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Pick a frame, choose wall or stand, then upload and crop the photo
            that goes inside. The frame, the print, and mailing it to you are
            all one price.
          </p>
        </Reveal>

        <div className="fr-grid">
          {cards.map((f, i) => (
            <Reveal key={f.id} delay={(i % 4) * 50}>
              <article className="fr-card">
                <button type="button" className="fr-card__imgbtn" onClick={() => setOpen(f)} aria-label={`See ${f.name}`}>
                  <img className="fr-card__img" src={f.thumb} alt={f.name} loading="lazy" />
                </button>
                <div className="fr-card__body">
                  <strong className="fr-card__name">{f.name}</strong>
                  <span className="fr-card__mounts">
                    {f.mounts.map((m) => MOUNT_LABELS[m] || m).join(' · ')}
                  </span>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(f)}>
                    {money(f.priceCents)} — see &amp; add
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>

      {open && (
        <FrameModal
          frame={open}
          signedIn={signedIn}
          onClose={() => setOpen(null)}
          onRequireAuth={onRequireAuth}
          onAdded={onAdded}
        />
      )}
    </section>
  )
}
