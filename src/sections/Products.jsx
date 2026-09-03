import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const products = [
  { icon: 'image', title: 'Photo prints', text: 'Upload one photo or a whole stack. Crop each to size, pick the format, and we print them at full quality and mail them.' },
  { icon: 'mail', title: 'Postcards', text: 'Hundreds of ready-made designs — or generate a one-of-a-kind card from a name and occasion. We print it and mail it.' },
  { icon: 'calendar', title: 'Photo calendars', text: 'Build a 2027 wall calendar: pick a background, drop in your framed photos, add a line of your own. 8×10 in, printed and mailed.' },
]

export default function Products() {
  return (
    <section className="section" id="products">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">What you can send</p>
          <h2 className="section__title">Three things we print and mail</h2>
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
