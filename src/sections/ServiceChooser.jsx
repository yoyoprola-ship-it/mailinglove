import Reveal from '../components/Reveal'
import Icon from '../components/Icon'
import { trackEvent } from '../track'

const CHOOSE_EVENT = {
  'photo-print': 'choose_photos',
  postcards: 'choose_postcards',
  calendar: 'choose_calendars',
}

// The top of the page: pick a service. Each card just goes to that
// service's page. The cart serves all of them.
export default function ServiceChooser({
  showPhotoPrint = true,
  showPostcards = true,
  showCalendars = false,
  onGo,
}) {
  const cards = []
  if (showPhotoPrint) {
    cards.push({
      id: 'photo-print',
      icon: 'image',
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
      icon: 'mail',
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
      icon: 'calendar',
      img: '/chooser-calendar.webp',
      eyebrow: 'Photo calendars',
      title: 'Make a calendar',
      text: 'Pick a background or use your own, place the months, drop in your photos — an 8×10 wall calendar, printed and mailed.',
      cta: 'Build a calendar',
    })
  }
  if (!cards.length) return null

  return (
    <section className="section chooser" id="start">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Photos &amp; postcards — printed and mailed</p>
          <h1 className="chooser__title">What do you want to send?</h1>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            We print it and mail it — to you, or straight to someone you love.
          </p>
        </Reveal>

        <div className={`chooser__grid${cards.length === 1 ? ' is-single' : ''}`}>
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={120 + i * 90}>
              <button
                type="button"
                className={`chooser__card chooser__card--${c.id}`}
                onClick={() => {
                  trackEvent(CHOOSE_EVENT[c.id])
                  onGo(c.id)
                }}
              >
                <span className="chooser__body">
                  <span className="chooser__icon">
                    <Icon name={c.icon} size={26} />
                  </span>
                  <span className="chooser__eyebrow">{c.eyebrow}</span>
                  <span className="chooser__name">{c.title}</span>
                  <span className="chooser__text">{c.text}</span>
                  <span className="chooser__cta">{c.cta} →</span>
                </span>
                <span className="chooser__media">
                  <img src={c.img} alt="" loading="lazy" />
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
