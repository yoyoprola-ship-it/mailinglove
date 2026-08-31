import { useEffect, useState } from 'react'
import Nav from './sections/Nav'
import Hero from './sections/Hero'
import Categories from './sections/Categories'
import HowItWorks from './sections/HowItWorks'
import Studio from './sections/Studio'
import Restore from './sections/Restore'
import Postcards from './sections/Postcards'
import CustomPostcard from './sections/CustomPostcard'
import Products from './sections/Products'
import Waitlist from './sections/Waitlist'
import Footer from './sections/Footer'
import AuthModal from './components/AuthModal'
import './App.css'

export default function App() {
  // The AI photo-redesign sections (Studio, Restore) are shown only while
  // the admin has generation enabled. Fail open if the check errors.
  const [aiEnabled, setAiEnabled] = useState(null)
  const [pcFilter, setPcFilter] = useState({ type: 'birthday', sub: null })
  const [signedIn, setSignedIn] = useState(false)
  const [authCtx, setAuthCtx] = useState(null) // null | {mode:'account'} | {mode:'add',postcard}

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((c) => setAiEnabled(Boolean(c.generateEnabled)))
      .catch(() => setAiEnabled(true))
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => setSignedIn(r.ok))
      .catch(() => {})
  }, [])

  function goToPostcards(type, sub = null) {
    setPcFilter({ type, sub })
    requestAnimationFrame(() =>
      document.getElementById('postcards')?.scrollIntoView({ behavior: 'smooth' })
    )
  }

  function openAccount() {
    if (signedIn) window.location.href = '/account'
    else setAuthCtx({ mode: 'account' })
  }

  function addPostcard(postcard) {
    if (signedIn) window.location.href = `/account?add=${postcard.id}`
    else setAuthCtx({ mode: 'add', postcard })
  }

  return (
    <div className="page">
      <Nav onNavigate={goToPostcards} onAccount={openAccount} />
      <Postcards filter={pcFilter} onFilter={setPcFilter} onAdd={addPostcard} />
      {aiEnabled && <CustomPostcard />}
      <Hero />
      <Categories />
      <HowItWorks />
      {aiEnabled && (
        <>
          <Studio />
          <Restore />
        </>
      )}
      <Products />
      <Waitlist />
      <Footer />

      {authCtx && (
        <AuthModal
          context={authCtx}
          onClose={() => setAuthCtx(null)}
          onSignedIn={() => setSignedIn(true)}
        />
      )}
    </div>
  )
}
