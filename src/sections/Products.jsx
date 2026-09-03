import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const products = [
  { icon: 'image', title: 'Photo prints', text: 'Upload one photo or a whole stack. Crop each to size, pick the format, and we print them at full quality and mail them.' },
  { icon: 'mail', title: 'Ready-made postcards', text: 'Hundreds of designs across every occasion. Add your message and who it\'s for, and we print it and mail it.' },
  { icon: 'sparkles', title: 'Design your own postcard', text: 'Give us a name and an occasion and AI creates a one-of-a-kind card — printed and mailed like the rest.' },
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
