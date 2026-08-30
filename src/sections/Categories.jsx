import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

const categories = [
  { icon: 'heart', title: 'Love', text: 'Anniversaries, "thinking of you," or just because — a postcard that says it better than a text.' },
  { icon: 'family', title: 'Family', text: 'Turn your favorite family photo into a keepsake print or calendar everyone will actually hang up.' },
  { icon: 'cake', title: 'Birthday', text: 'A birthday card that shows up in the mailbox, not lost in a group chat.' },
  { icon: 'snowflake', title: 'Christmas', text: 'Holiday cards and calendars, redesigned around your own family photos.' },
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
