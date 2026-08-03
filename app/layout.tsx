import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '../components/ThemeProvider'
import { AuthProvider } from '../components/AuthProvider'

/*
  interactiveWidget tells the browser to shrink the LAYOUT viewport when the
  on-screen keyboard opens, so 100dvh actually means "what you can see".
  Without it dvh only tracks browser chrome like the address bar, and a
  keyboard just covers the bottom of the page.
*/
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'ClearRent — Rent Without Regret',
  description: 'Nigeria\'s verification-first rental platform. Connect directly with verified landlords and tenants in Lagos. No fraud, no fake listings, no middlemen.',
  keywords: 'rent Lagos, verified landlord Nigeria, find apartment Lagos, rental platform Nigeria, no fraud rent',
  openGraph: {
    title: 'ClearRent — Rent Without Regret',
    description: 'Nigeria\'s verification-first rental platform. Find verified properties in Lagos.',
    url: 'https://verealtytech.com',
    siteName: 'ClearRent',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearRent — Rent Without Regret',
    description: 'Nigeria\'s verification-first rental platform.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before first paint so the saved theme is already on <html>.
          Without it the page paints with the SYSTEM theme and only corrects
          after hydration, so anyone whose choice differs from their OS sees a
          flash of the wrong one. The suppressHydrationWarning above exists for
          precisely this attribute — the script was the missing half.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('clearrent-theme')||'system';" +
              "var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
              "document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()",
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}