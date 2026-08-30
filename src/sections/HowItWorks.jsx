import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const steps = [
  { icon: 'upload', title: 'Upload your photos', text: 'Send us the photo (or photos) you want to turn into something special.' },
  { icon: 'sparkles', title: 'We redesign it with AI', text: 'New backgrounds, styles, and layouts — matched to the occasion you pick.' },
  { icon: 'image', title: 'Choose your format', text: 'Postcard, calendar, or keepsake print — whatever fits what you\'re sending.' },
  { icon: 'mail', title: 'We print & mail it', text: 'It goes out in a real envelope, to a real mailbox. No app for them to install.' },
]

export default function HowItWorks() {
  return (
    <section className="section section--dark" id="how-it-works">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">How it works</p>
          <h2 className="section__title section__title--light">From photo to mailbox in four steps</h2>
        </Reveal>
        <div className="grid grid--4 steps">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="step">
                <span className="step__number">{i + 1}</span>
                <span className="icon-badge icon-badge--light">
                  <Icon name={s.icon} />
                </span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__text">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
