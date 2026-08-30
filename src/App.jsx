import Nav from './sections/Nav'
import Hero from './sections/Hero'
import Categories from './sections/Categories'
import HowItWorks from './sections/HowItWorks'
import Products from './sections/Products'
import Waitlist from './sections/Waitlist'
import Footer from './sections/Footer'
import './App.css'

export default function App() {
  return (
    <div className="page">
      <Nav />
      <Hero />
      <Categories />
      <HowItWorks />
      <Products />
      <Waitlist />
      <Footer />
    </div>
  )
}
