import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Problem from '../components/Problem'
import HowItWorks from '../components/HowItWorks'
import WhyClearRent from '../components/WhyClearRent'
import Pricing from '../components/Pricing'
import Waitlist from '../components/Waitlist'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Problem />
      <HowItWorks />
      <WhyClearRent />
      <Pricing />
      <Waitlist />
      <Footer />
    </main>
  )
}