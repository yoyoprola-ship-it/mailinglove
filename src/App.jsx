import { useEffect, useRef, useState } from 'react'
import Nav from './sections/Nav'
import Hero from './sections/Hero'
import Categories from './sections/Categories'
import HowItWorks from './sections/HowItWorks'
import Studio from './sections/Studio'
import Restore from './sections/Restore'
import ServiceChooser from './sections/ServiceChooser'
import Postcards from './sections/Postcards'
import CustomPostcard from './sections/CustomPostcard'
import PhotoPrint from './sections/PhotoPrint'
import Products from './sections/Products'
import Footer from './sections/Footer'
import AuthModal from './components/AuthModal'
import SupportChat from './components/SupportChat'
import './App.css'

const countCards = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)

export default function App() {
  // The AI sections are shown only while the admin has each one enabled.
  // Fail open if the check errors.
  const [photoEnabled, setPhotoEnabled] = useState(null)
  const [postcardEnabled, setPostcardEnabled] = useState(null)
  const [photoPrintEnabled, setPhotoPrintEnabled] = useState(false)
  const [photoPrintFormats10, setPhotoPrintFormats10] = useState([])
  const [photoPrintFormatsCatalog, setPhotoPrintFormatsCatalog] = useState([])
  const [perPage, setPerPage] = useState(25)
  const [postcardSizes, setPostcardSizes] = useState(null)
  const [postcardPriceCents, setPostcardPriceCents] = useState(0)
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
        setPhotoPrintEnabled(Boolean(c.photoPrintEnabled))
        if (Array.isArray(c.photoPrintFormats10)) setPhotoPrintFormats10(c.photoPrintFormats10)
        if (Array.isArray(c.photoPrintFormatsCatalog))
          setPhotoPrintFormatsCatalog(c.photoPrintFormatsCatalog)
        if (Number.isFinite(c.postcardsPerPage)) setPerPage(c.postcardsPerPage)
        if (Array.isArray(c.postcardSizes) && c.postcardSizes.length) setPostcardSizes(c.postcardSizes)
        if (Number.isFinite(c.postcardPriceCents)) setPostcardPriceCents(c.postcardPriceCents)
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
  const hasPhotoPrint =
    photoPrintEnabled && photoPrintFormats10.length + photoPrintFormatsCatalog.length > 0

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

  function scrollToId(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // Only long trips (past the lazy-loading gallery) drift as images settle —
    // re-aim a few times for those. Any manual scroll/touch/key cancels the
    // chase so the viewer isn't yanked back.
    const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 1.2
    if (!far) return

    const timers = [250, 600, 1100, 1700].map((t) =>
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), t)
    )
    const cancel = () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', cancel)
    }
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('keydown', cancel)
    setTimeout(cancel, 1900)
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
        onGo={scrollToId}
        cartCount={cartCount}
        showPhotoPrint={hasPhotoPrint}
        showPostcardGen={postcardEnabled}
        showPhotoRestore={Boolean(photoEnabled)}
      />
      <ServiceChooser showPhotoPrint={hasPhotoPrint} showPostcards onGo={scrollToId} />
      {hasPhotoPrint && (
        <PhotoPrint
          formats10={photoPrintFormats10}
          formatsCatalog={photoPrintFormatsCatalog}
          signedIn={signedIn}
          onAdded={(items) => Array.isArray(items) && setCartItems(items)}
          onRequireAuth={() => setAuthCtx({ mode: 'account' })}
        />
      )}
      <Postcards
        filter={pcFilter}
        onFilter={setPcFilter}
        onAdd={addPostcard}
        onDec={decFromCart}
        cartQtyFor={cartQty}
        perPage={perPage}
      />
      {postcardEnabled && (
        <CustomPostcard
          sizes={postcardSizes}
          priceCents={postcardPriceCents}
          signedIn={signedIn}
          onAdded={(items) => Array.isArray(items) && setCartItems(items)}
          onRequireAuth={() => setAuthCtx({ mode: 'account' })}
        />
      )}
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
      <Footer />

      {toast && <div className="toast">{toast}</div>}

      {authCtx && (
        <AuthModal context={authCtx} onClose={() => setAuthCtx(null)} onSignedIn={onSignedIn} />
      )}

      <SupportChat signedIn={signedIn} onRequireAuth={() => setAuthCtx({ mode: 'account' })} />
    </div>
  )
}
