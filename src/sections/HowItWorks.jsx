import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const steps = [
  { icon: 'image', title: 'Pick what to send', text: 'Print your own photos, or choose a ready-made postcard.' },
  { icon: 'upload', title: 'Make it yours', text: 'Upload and crop your photos, add a message and a size — or let AI design a postcard from a name and occasion.' },
  { icon: 'mail', title: 'Say who it’s for', text: 'Your address or theirs. US addresses, checked as you type.' },
  { icon: 'check', title: 'We print & mail it', text: 'Real paper in a real envelope, straight to a real mailbox. No app for them to install.' },
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
        <Reveal delay={steps.length * 90}>
          <p className="steps__eta">
            <Icon name="mail" size={16} />
            <span>
              Once your envelope is on its way, it usually reaches the mailbox in{' '}
              <strong>3–9 business days</strong> — anywhere in the US. We hand every
              order to USPS within one business day of printing.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
