import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Problem from '../components/Problem'
import HowItWorks from '../components/HowItWorks'
import WhyClearRent from '../components/WhyClearRent'
import Pricing from '../components/Pricing'
import Waitlist from '../components/Waitlist'
import Footer from '../components/Footer'
import { getPublicPricing } from '../lib/public-pricing'
import { verificationLine } from '../lib/format'

// Prices come from config/pricing, so an admin change shows within minutes.
export const revalidate = 300

export default async function Home() {
  const pricing = await getPublicPricing()
  const agentVerification = verificationLine(pricing.verification.agent)
  return (
    <main>
      <Navbar />
      <Hero />
      <Problem />
      <HowItWorks agentVerification={agentVerification} />
      <WhyClearRent agentVerification={agentVerification} />
      <Pricing pricing={pricing} />
      <Waitlist />
      <Footer />
    </main>
  )
}