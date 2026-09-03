import PhotoStudio from '../components/PhotoStudio'
import Reveal from '../components/Reveal'

const modes = [
  { value: 'modernize', label: 'Modernize — fill missing pieces, deblur & add color' },
  { value: 'restore', label: 'Restore — repair damage, keep the vintage look' },
]

export default function Restore() {
  return (
    <section className="section section--dark" id="restore">
      <div className="section-inner">
        <Reveal>
          <p className="eyebrow eyebrow--light">Old photos</p>
          <h2 className="section__title section__title--light">
            Bring an old photo back to life
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="section__lead section__lead--light">
            Scan a faded, torn, or blurry black-and-white photo. AI rebuilds the
            missing pieces, sharpens soft faces, and adds realistic color — or
            keeps the original vintage look if you'd rather. Download it free, then
            print and mail it through <a href="#photo-print">Print your photos</a>.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <PhotoStudio
            options={modes}
            selectLabel="What should we do?"
            submitIdle="Restore my photo"
            submitBusy="Restoring…"
            resultIcon="image"
            placeholder="Your restored photo shows up here"
          />
        </Reveal>
      </div>
    </section>
  )
}
