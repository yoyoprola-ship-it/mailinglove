import { useEffect, useRef, useState } from 'react'
import Nav from './sections/Nav'
import Hero from './sections/Hero'
import Categories from './sections/Categories'
import HowItWorks from './sections/HowItWorks'
import Studio from './sections/Studio'
import Restore from './sections/Restore'
import ServiceChooser from './sections/ServiceChooser'
import PostcardStrip from './sections/PostcardStrip'
import Postcards from './sections/Postcards'
import CustomPostcard from './sections/CustomPostcard'
import CalendarMaker from './sections/CalendarMaker'
import PhotoPrint from './sections/PhotoPrint'
import Products from './sections/Products'
import Footer from './sections/Footer'
import AuthModal from './components/AuthModal'
import SupportChat from './components/SupportChat'
import { mpTrack } from './metaPixel'
import { trackEvent } from './track'
import './App.css'

const countCards = (items) => items.reduce((n, i) => n + (i.qty || 1), 0)

const urlParams = new URLSearchParams(window.location.search)
// Each service has its own page now; anything else is the home / landing.
const PATH = window.location.pathname
const PAGE =
  PATH === '/photos'
    ? 'photos'
    : PATH === '/postcards'
      ? 'postcards'
      : PATH === '/calendars'
        ? 'calendars'
        : 'home'

// ?type=&sub= (from the menu / an old deep link) seeds the postcard filter.
const initialFilter = {
  type: urlParams.get('type') || 'birthday',
  sub: urlParams.get('sub') || null,
}

const PAGE_META = {
  home: {
    title: 'MailingLove — Photo Prints & Postcards, Printed and Mailed',
    path: '/',
  },
  photos: { title: 'Print & mail your photos — MailingLove', path: '/photos' },
  postcards: { title: 'Send a postcard, printed & mailed — MailingLove', path: '/postcards' },
  calendars: { title: 'Make a photo calendar — MailingLove', path: '/calendars' },
}

// Old links pointed at #photo-print / #postcards / ?type= on the home
// page. Send them to the new pages before React even renders.
if (PAGE === 'home') {
  const hash = (window.location.hash || '').replace(/^#/, '')
  const q = urlParams.toString()
  if (hash === 'photo-print') window.location.replace('/photos')
  else if (hash === 'postcards' || urlParams.get('type'))
    window.location.replace(`/postcards${q ? `?${q}` : ''}`)
  else if (hash === 'custom-postcard') window.location.replace('/postcards#custom-postcard')
  else if (hash === 'calendar') window.location.replace('/calendars')
}

export default function App() {
  // The AI sections are shown only while the admin has each one enabled.
  // Fail open if the check errors.
  const [photoEnabled, setPhotoEnabled] = useState(null)
  const [postcardEnabled, setPostcardEnabled] = useState(null)
  const [photoPrintEnabled, setPhotoPrintEnabled] = useState(false)
  const [photoPrintFormats10, setPhotoPrintFormats10] = useState([])
  const [photoPrintFormatsCatalog, setPhotoPrintFormatsCatalog] = useState([])
  // Until the config is in, assume both services are on so the chooser
  // paints its final shape once instead of adding the photos card a beat
  // after the postcards card.
  const [configLoaded, setConfigLoaded] = useState(false)
  const [perPage, setPerPage] = useState(25)
  const [postcardSizes, setPostcardSizes] = useState(null)
  const [postcardPriceCents, setPostcardPriceCents] = useState(0)
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarYear, setCalendarYear] = useState(2027)
  const [calendarPriceCents, setCalendarPriceCents] = useState(0)
  const [pcFilter, setPcFilter] = useState(initialFilter)
  const [signedIn, setSignedIn] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [toast, setToast] = useState('')
  const [authCtx, setAuthCtx] = useState(null) // null | {mode:'account'} | {mode:'add',postcard}
  const toastTimer = useRef(null)

  useEffect(() => {
    // Reuse the warm-up request the static HTML already fired, if it's
    // still around, so the server is only hit once.
    const boot =
      window.__bootFetch?.then((r) => (r && r.ok ? r.clone().json() : null)).catch(() => null) ||
      Promise.resolve(null)

    boot
      .then((pre) => pre || fetch('/api/site-config').then((r) => r.json()))
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
        setCalendarEnabled(Boolean(c.calendarEnabled))
        if (Number.isFinite(c.calendarYear)) setCalendarYear(c.calendarYear)
        if (Number.isFinite(c.calendarPriceCents)) setCalendarPriceCents(c.calendarPriceCents)
      })
      .catch(() => {
        setPhotoEnabled(true)
        setPostcardEnabled(true)
      })
      .finally(() => {
        setConfigLoaded(true)
        window.__hideBootSplash?.()
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

  // A remaining #hash on the home page (how-it-works, restore, …): scroll
  // there once, then drop it so a refresh doesn't jump back. On /postcards,
  // #custom-postcard scrolls to the "design your own" block.
  useEffect(() => {
    const hash = (window.location.hash || '').replace(/^#/, '')
    if (!hash) return
    if (PAGE === 'postcards') {
      if (hash === 'custom-postcard') {
        const t = setTimeout(() => scrollToId('custom-postcard'), 300)
        return () => clearTimeout(t)
      }
      return
    }
    if (PAGE !== 'home') return
    const t = setTimeout(() => scrollToId(hash), 250)
    const u = new URL(window.location.href)
    u.hash = ''
    history.replaceState(null, '', u.pathname + u.search)
    return () => clearTimeout(t)
  }, [])

  // In-page anchor links (home only): scroll there, then drop the #hash.
  useEffect(() => {
    function onHash() {
      const id = window.location.hash.replace(/^#/, '')
      if (!id) return
      scrollToId(id)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Per-page title + canonical (all pages share one index.html).
  useEffect(() => {
    const m = PAGE_META[PAGE]
    if (!m) return
    document.title = m.title
    const c = document.querySelector('link[rel="canonical"]')
    if (c) c.href = `https://mailinglove.com${m.path}`
  }, [])

  const cartCount = countCards(cartItems)
  const hasPhotoPrint =
    photoPrintEnabled && photoPrintFormats10.length + photoPrintFormatsCatalog.length > 0
  // What the chooser/nav should assume before the config lands.
  const showPhotoPrintNav = !configLoaded || hasPhotoPrint

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
      const cents = postcard.priceCents || postcardPriceCents || 0
      mpTrack('AddToCart', {
        content_type: 'product',
        content_ids: [postcard.id],
        content_name: postcard.title || 'Postcard',
        value: cents / 100,
        currency: 'USD',
      })
      trackEvent('add_to_cart', { valueCents: cents })
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

  // Nav / chooser targets. Photo printing and postcards are pages now;
  // everything else is a section on the home page.
  function navigate(to) {
    if (to === 'photo-print') return void (window.location.href = '/photos')
    if (to === 'postcards') return void (window.location.href = '/postcards')
    if (to === 'calendar') return void (window.location.href = '/calendars')
    if (to === 'custom-postcard') {
      if (PAGE === 'postcards') return scrollToId('custom-postcard')
      return void (window.location.href = '/postcards#custom-postcard')
    }
    if (PAGE === 'home') return scrollToId(to)
    window.location.href = `/#${to}`
  }

  function goToPostcards(type, sub = null) {
    if (PAGE === 'postcards') {
      setPcFilter({ type, sub })
      requestAnimationFrame(() =>
        document.getElementById('postcards')?.scrollIntoView({ behavior: 'smooth' })
      )
      return
    }
    const q = new URLSearchParams({ type })
    if (sub) q.set('sub', sub)
    window.location.href = `/postcards?${q.toString()}`
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

  function openOrders() {
    if (signedIn) window.location.href = '/account?tab=orders'
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

  const unavailable = (eyebrow, what) => (
    <section className="section">
      <div className="section-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section__title">{what} isn't available right now</h2>
        <p className="section__lead">
          It's temporarily switched off. <a href="/">Back to home</a>.
        </p>
      </div>
    </section>
  )

  const photoPrintNode = hasPhotoPrint ? (
    <PhotoPrint
      formats10={photoPrintFormats10}
      formatsCatalog={photoPrintFormatsCatalog}
      signedIn={signedIn}
      onAdded={(items) => Array.isArray(items) && setCartItems(items)}
      onRequireAuth={() => setAuthCtx({ mode: 'account' })}
    />
  ) : (
    unavailable('Print your photos', 'Photo printing')
  )

  const calendarNode = calendarEnabled ? (
    <CalendarMaker
      year={calendarYear}
      priceCents={calendarPriceCents}
      signedIn={signedIn}
      onAdded={(items) => Array.isArray(items) && setCartItems(items)}
      onRequireAuth={() => setAuthCtx({ mode: 'account' })}
    />
  ) : (
    unavailable('Photo calendars', 'The calendar maker')
  )

  return (
    <div className="page">
      <Nav
        onNavigate={goToPostcards}
        onAccount={openAccount}
        onCart={openCart}
        onOrders={openOrders}
        onGo={navigate}
        cartCount={cartCount}
        showPhotoPrint={showPhotoPrintNav}
        showPostcardGen={postcardEnabled}
        showPhotoRestore={Boolean(photoEnabled)}
        showCalendar={calendarEnabled}
      />

      {PAGE === 'home' && (
        <>
          <ServiceChooser showPhotoPrint={showPhotoPrintNav} showPostcards onGo={navigate} />
          <PostcardStrip />
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
        </>
      )}

      {PAGE === 'photos' && (
        <>
          <div className="svc-page">{photoPrintNode}</div>
          <Footer />
        </>
      )}

      {PAGE === 'calendars' && (
        <>
          <div className="svc-page">{calendarNode}</div>
          <Footer />
        </>
      )}

      {PAGE === 'postcards' && (
        <>
          <div className="svc-page">
            <Postcards
              filter={pcFilter}
              onFilter={setPcFilter}
              onAdd={addPostcard}
              onDec={decFromCart}
              cartQtyFor={cartQty}
              perPage={perPage}
              priceCents={postcardPriceCents}
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
          </div>
          <Footer />
        </>
      )}

      {toast && <div className="toast">{toast}</div>}

      {authCtx && (
        <AuthModal context={authCtx} onClose={() => setAuthCtx(null)} onSignedIn={onSignedIn} />
      )}

      <SupportChat signedIn={signedIn} onRequireAuth={() => setAuthCtx({ mode: 'account' })} />
    </div>
  )
}
