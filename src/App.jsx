import { useEffect, useState } from 'react'
import Nav from './sections/Nav'
import Hero from './sections/Hero'
import Categories from './sections/Categories'
import HowItWorks from './sections/HowItWorks'
import Studio from './sections/Studio'
import Restore from './sections/Restore'
import Postcards from './sections/Postcards'
import Products from './sections/Products'
import Waitlist from './sections/Waitlist'
import Footer from './sections/Footer'
import './App.css'

export default function App() {
  // The AI photo-redesign sections (Studio, Restore) are shown only while
  // the admin has generation enabled. Fail open if the check errors.
  const [aiEnabled, setAiEnabled] = useState(null)

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((c) => setAiEnabled(Boolean(c.generateEnabled)))
      .catch(() => setAiEnabled(true))
  }, [])

  return (
    <div className="page">
      <Nav />
      <Hero />
      <Categories />
      <HowItWorks />
      <Postcards />
      {aiEnabled && (
        <>
          <Studio />
          <Restore />
        </>
      )}
      <Products />
      <Waitlist />
      <Footer />
    </div>
  )
}
