import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero__glow" />
      <div className="section-inner hero__inner">
        <Reveal>
          <p className="eyebrow">AI-designed keepsakes, delivered by mail</p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="hero__title">
            Your photos, <em>reimagined</em>.
            <br />
            Mailed to the people you love.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="hero__subtitle">
            Upload a photo. We redesign it with AI — new backgrounds, styles, and
            layouts — and turn it into a postcard, calendar, or keepsake print.
            Then we print it and mail it, so someone you love finds it in their
            actual mailbox.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#waitlist">
              Join the waitlist
            </a>
            <a className="btn btn--ghost" href="#how-it-works">
              See how it works
            </a>
          </div>
        </Reveal>
        <Reveal delay={320}>
          <div className="hero__badge">
            <Icon name="mail" size={16} />
            <span>Coming soon — be first in line</span>
          </div>
        </Reveal>
      </div>
    </header>
  )
}
