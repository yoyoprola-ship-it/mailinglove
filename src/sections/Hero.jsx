import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

export default function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero__glow" />
      <div className="section-inner hero__inner">
        <Reveal>
          <p className="eyebrow">Photo prints &amp; postcards, delivered by mail</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="hero__title">
            Your photos, <em>printed</em>.
            <br />
            Mailed to the people you love.
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="hero__subtitle">
            Upload your photos and we print them at full quality and mail them —
            to you or straight to someone you love. Rather send a ready-made
            postcard? Pick one and we print and mail that too.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#photo-print">
              Print your photos
            </a>
            <a className="btn btn--ghost" href="#how-it-works">
              See how it works
            </a>
          </div>
        </Reveal>
        <Reveal delay={320}>
          <div className="hero__badge">
            <Icon name="mail" size={16} />
            <span>Printed and mailed — straight to their mailbox</span>
          </div>
        </Reveal>
      </div>
    </header>
  )
}
