import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const categories = [
  { icon: 'heart', title: 'Love', text: 'Anniversaries, "thinking of you," or just because — a card that lands in the mailbox, not the group chat.' },
  { icon: 'family', title: 'Family', text: 'Your favorite family photo, printed and mailed — or a whole year of them on a photo calendar.' },
  { icon: 'cake', title: 'Birthday', text: 'A birthday card that actually shows up, not another notification.' },
  { icon: 'snowflake', title: 'Christmas', text: 'Holiday postcards and photo calendars, ready before the rush.' },
]

export default function Categories() {
  return (
    <section className="section" id="categories">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Categories</p>
          <h2 className="section__title">Made for every reason to reach out</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Pick the occasion, and we'll help you design something worth mailing.
          </p>
        </Reveal>
        <div className="grid grid--4">
          {categories.map((c, i) => (
            <Reveal key={c.title} delay={i * 90}>
              <div className="card card--category">
                <span className="icon-badge">
                  <Icon name={c.icon} />
                </span>
                <h3 className="card__title">{c.title}</h3>
                <p className="card__text">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
