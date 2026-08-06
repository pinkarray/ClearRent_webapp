import NextStep from '../../components/NextStep'
import PublicHeader from '../../components/PublicHeader'

/*
  A server component, so the listing pages below keep their server rendering and
  their ISR revalidation. Only the header and the next-step banner are client
  components.

  Browse is the one product surface outside AppShell, so it was also the one
  place a signed-in user could stand and be told nothing — and it is squarely on
  the demo path, since "go and look at the listings again" is the most natural
  thing to do while waiting on the other party. NextStep renders nothing for
  signed-out visitors, so the public page stays public.
*/
export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface min-h-screen bg-bg">
      <PublicHeader />
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 empty:hidden sm:px-6">
        <NextStep />
      </div>
      {children}
    </div>
  )
}
