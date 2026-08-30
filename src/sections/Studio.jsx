import PhotoStudio from '../components/PhotoStudio'
import Reveal from '../components/Reveal'

const occasions = [
  { value: 'love', label: 'Love' },
  { value: 'family', label: 'Family' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'christmas', label: 'Christmas' },
]

export default function Studio() {
  return (
    <section className="section" id="studio">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow">Try it now</p>
          <h2 className="section__title">See your photo, redesigned</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead">
            Upload a photo, pick the occasion, and watch AI turn it into something
            worth mailing. This is a preview — printing and mail come later.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <PhotoStudio
            options={occasions}
            selectLabel="Occasion"
            submitIdle="Redesign my photo"
            submitBusy="Redesigning…"
            resultIcon="sparkles"
            placeholder="Your redesign shows up here"
          />
        </Reveal>
      </div>
    </section>
  )
}
