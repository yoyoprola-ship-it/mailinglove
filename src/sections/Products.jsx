import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const products = [
  { icon: 'mail', title: 'Postcards', text: 'A single photo, redesigned and printed on a real postcard, stamped and mailed.' },
  { icon: 'calendar', title: 'Calendars', text: 'Twelve of your favorite photos, one per month, printed and mailed as a keepsake calendar.' },
  { icon: 'image', title: 'Keepsake prints', text: 'Family portraits with new backgrounds and styles, printed to frame or gift.' },
]

export default function Products() {
  return (
    <section className="section" id="products">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">What you can send</p>
          <h2 className="section__title">Three ways to say it with mail</h2>
        </Reveal>
        <div className="grid grid--3">
          {products.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <div className="card">
                <span className="icon-badge">
                  <Icon name={p.icon} />
                </span>
                <h3 className="card__title">{p.title}</h3>
                <p className="card__text">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
