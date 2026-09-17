import { useState } from 'react'
import Reveal from '../components/Reveal'
import { trackEvent } from '../track'

const CHOOSE_EVENT = {
  'photo-print': 'choose_photos',
  postcards: 'choose_postcards',
  calendar: 'choose_calendars',
  frames: 'choose_frames',
}

// The top of the page: pick a service. Each row is collapsed to a compact
// thumbnail + title by default — tap it to read the description, tap the
// CTA to actually go. Keeps every option visible on one mobile screen
// instead of a tall illustrated card per service.
export default function ServiceChooser({
  showPhotoPrint = true,
  showPostcards = true,
  showCalendars = false,
  showFrames = false,
  onGo,
}) {
  const [openId, setOpenId] = useState(null)

  const cards = []
  if (showPhotoPrint) {
    cards.push({
      id: 'photo-print',
      img: '/chooser-photos.webp',
      eyebrow: 'Your photos',
      title: 'Print your photos',
      text: 'Upload one photo or many, crop each to size, and we print them at full quality and mail them.',
      cta: 'Print photos',
    })
  }
  if (showPostcards) {
    cards.push({
      id: 'postcards',
      img: '/chooser-postcards.webp',
      eyebrow: 'Ready to send',
      title: 'Send a postcard',
      text: 'Choose from hundreds of designs or generate your own. We print it and mail it for you.',
      cta: 'Browse postcards',
    })
  }
  if (showCalendars) {
    cards.push({
      id: 'calendar',
      img: '/chooser-calendar.webp',
      eyebrow: 'Photo calendars',
      title: 'Make a calendar',
      text: 'Pick a background or use your own, place the months, drop in your photos — an 8×10 wall calendar, printed and mailed.',
      cta: 'Build a calendar',
    })
  }
  if (showFrames) {
    cards.push({
      id: 'frames',
      img: '/chooser-frames.webp',
      eyebrow: 'Framed photos',
      title: 'Frame a photo',
      text: 'Pick a frame style, choose wall or stand, then upload and crop your photo — the frame, the print, and shipping in one price.',
      cta: 'Browse frames',
    })
  }
  if (!cards.length) return null

  function go(id) {
    trackEvent(CHOOSE_EVENT[id])
    onGo(id)
  }

  return (
    <section className="section chooser" id="start">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Photos &amp; postcards — printed and mailed</p>
          <h1 className="chooser__title">What do you want to send?</h1>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            We print it and mail it — to you, or straight to someone you love. Tap one to see more.
          </p>
        </Reveal>

        <div className={`chooser__grid${cards.length === 1 ? ' is-single' : ''}`}>
          {cards.map((c, i) => {
            const open = openId === c.id
            return (
              <Reveal key={c.id} delay={80 + i * 40}>
                <div className={`chooser__card chooser__card--${c.id}${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="chooser__head"
                    onClick={() => setOpenId(open ? null : c.id)}
                    aria-expanded={open}
                  >
                    <img className="chooser__thumb" src={c.img} alt="" loading="lazy" />
                    <span className="chooser__head-text">
                      <span className="chooser__eyebrow">{c.eyebrow}</span>
                      <span className="chooser__name">{c.title}</span>
                    </span>
                    <span className="chooser__chev" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                  </button>

                  {open && (
                    <div className="chooser__more">
                      <p className="chooser__text">{c.text}</p>
                      <button type="button" className="chooser__go" onClick={() => go(c.id)}>
                        {c.cta} →
                      </button>
                    </div>
                  )}
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
