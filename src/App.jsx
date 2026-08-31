import { useEffect, useRef, useState } from 'react'
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

const countCards = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)

export default function App() {
  // The AI sections are shown only while the admin has each one enabled.
  // Fail open if the check errors.
  const [photoEnabled, setPhotoEnabled] = useState(null)
  const [postcardEnabled, setPostcardEnabled] = useState(null)
  const [perPage, setPerPage] = useState(25)
  const [postcardSizes, setPostcardSizes] = useState(null)
  const [pcFilter, setPcFilter] = useState({ type: 'birthday', sub: null })
  const [signedIn, setSignedIn] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [toast, setToast] = useState('')
  const [authCtx, setAuthCtx] = useState(null) // null | {mode:'account'} | {mode:'add',postcard}
  const toastTimer = useRef(null)

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((c) => {
        setPhotoEnabled(Boolean(c.photoRedesignEnabled))
        setPostcardEnabled(Boolean(c.postcardDesignEnabled))
        if (Number.isFinite(c.postcardsPerPage)) setPerPage(c.postcardsPerPage)
        if (Array.isArray(c.postcardSizes) && c.postcardSizes.length) setPostcardSizes(c.postcardSizes)
      })
      .catch(() => {
        setPhotoEnabled(true)
        setPostcardEnabled(true)
      })
    fetch('/api/cart', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSignedIn(true)
          setCartItems(d.items || [])
        }
      })
      .catch(() => {})
  }, [])

  const cartCount = countCards(cartItems)

  // qty of a design in the cart, for the gallery stepper. 0 if not in cart.
  function cartQty(postcardId) {
    return cartItems
      .filter((i) => i.postcardId === postcardId)
      .reduce((n, i) => n + (i.qty || 1), 0)
  }

  function flash(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  async function cartPost(url, postcard) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postcardId: postcard.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not update the cart.')
    setCartItems(data.items || [])
    return data
  }

  async function addToCart(postcard) {
    try {
      await cartPost('/api/cart', postcard)
    } catch (err) {
      flash(err.message)
    }
  }

  async function decFromCart(postcard) {
    try {
      await cartPost('/api/cart/dec', postcard)
    } catch (err) {
      flash(err.message)
    }
  }

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

  function openCart() {
    if (signedIn) window.location.href = '/account?tab=cart'
    else setAuthCtx({ mode: 'account' })
  }

  function addPostcard(postcard) {
    if (signedIn) addToCart(postcard)
    else setAuthCtx({ mode: 'add', postcard })
  }

  function onSignedIn() {
    setSignedIn(true)
    if (authCtx?.mode === 'add' && authCtx.postcard) {
      addToCart(authCtx.postcard)
      setAuthCtx(null)
    }
  }

  return (
    <div className="page">
      <Nav
        onNavigate={goToPostcards}
        onAccount={openAccount}
        onCart={openCart}
        cartCount={cartCount}
      />
      <Postcards
        filter={pcFilter}
        onFilter={setPcFilter}
        onAdd={addPostcard}
        onDec={decFromCart}
        cartQtyFor={cartQty}
        perPage={perPage}
      />
      {postcardEnabled && <CustomPostcard sizes={postcardSizes} />}
      <Hero />
      <Categories />
      <HowItWorks />
      {photoEnabled && (
        <>
          <Studio />
          <Restore />
        </>
      )}
      <Products />
      <Waitlist />
      <Footer />

      {toast && <div className="toast">{toast}</div>}

      {authCtx && (
        <AuthModal context={authCtx} onClose={() => setAuthCtx(null)} onSignedIn={onSignedIn} />
      )}
    </div>
  )
}
