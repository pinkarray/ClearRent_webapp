import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '../components/ThemeProvider'
import { AuthProvider } from '../components/AuthProvider'

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