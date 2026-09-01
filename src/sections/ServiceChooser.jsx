import Reveal from '../components/Reveal'

// The top of the page: pick a service. Both options carry equal weight;
// each one just scrolls down to its section. The cart serves both.
export default function ServiceChooser({ showPhotoPrint = true, showPostcards = true, onGo }) {
  const cards = []
  if (showPhotoPrint) {
    cards.push({
      id: 'photo-print',
      img: '/chooser-photos.jpg',
      eyebrow: 'Your photos',
      title: 'Print your photos',
      text: 'Upload one photo or many, crop each to size, and we print them at full quality and mail them.',
      cta: 'Print photos',
    })
  }
  if (showPostcards) {
    cards.push({
      id: 'postcards',
      img: '/chooser-postcards.jpg',
      eyebrow: 'Ready to send',
      title: 'Send a postcard',
      text: 'Choose from hundreds of designs or generate your own. We print it and mail it for you.',
      cta: 'Browse postcards',
    })
  }
  if (!cards.length) return null

  return (
    <section className="section chooser" id="start">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Photos &amp; postcards, printed and mailed</p>
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
              <button type="button" className="chooser__card" onClick={() => onGo(c.id)}>
                <span className="chooser__media">
                  <img src={c.img} alt="" loading="lazy" />
                </span>
                <span className="chooser__body">
                  <span className="chooser__eyebrow">{c.eyebrow}</span>
                  <span className="chooser__name">{c.title}</span>
                  <span className="chooser__text">{c.text}</span>
                  <span className="chooser__cta">{c.cta} →</span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
