import PublicHeader from '../../components/PublicHeader'

/*
  A server component, so the listing pages below keep their server rendering and
  their ISR revalidation. Only the header itself is a client component.
*/
export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface min-h-screen bg-bg">
      <PublicHeader />
      {children}
    </div>
  )
}
