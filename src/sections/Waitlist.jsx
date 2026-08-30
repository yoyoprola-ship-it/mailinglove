import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import Icon from '../components/Icon'
import Reveal from '../components/Reveal'

export default function Waitlist() {
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('idle') // idle | saving | done | error

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('saving')
    try {
      await addDoc(collection(db, 'waitlist'), {
        email: email.trim().toLowerCase(),
        category: category || null,
        createdAt: serverTimestamp(),
      })
      setStatus('done')
      setEmail('')
      setCategory('')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <section className="section section--dark" id="waitlist">
      <div className="section-inner waitlist">
        <Reveal>
          <span className="brand__mark brand__mark--lg">
            <Icon name="heart" size={26} />
          </span>
          <h2 className="section__title section__title--light">Be the first to try MailingLove</h2>
          <p className="section__lead section__lead--light">
            We're building this now. Join the waitlist and we'll let you know the
            moment you can create your first postcard.
          </p>
        </Reveal>

        {status === 'done' ? (
          <Reveal delay={80}>
            <p className="waitlist__success">
              <Icon name="check" size={18} /> You're on the list — we'll be in touch.
            </p>
          </Reveal>
        ) : (
          <Reveal delay={80}>
            <form className="waitlist__form" onSubmit={handleSubmit}>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Mostly interested in…</option>
                <option value="love">Love</option>
                <option value="family">Family</option>
                <option value="birthday">Birthday</option>
                <option value="christmas">Christmas</option>
              </select>
              <button className="btn btn--primary" type="submit" disabled={status === 'saving'}>
                {status === 'saving' ? 'Joining…' : 'Join the waitlist'}
              </button>
            </form>
            {status === 'error' && (
              <p className="waitlist__error">Something went wrong — try again in a moment.</p>
            )}
          </Reveal>
        )}
      </div>
    </section>
  )
}
