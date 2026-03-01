import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AccentProvider } from '@/components/accent-provider'
import { Toaster } from '@/components/ui/sonner'
import { siteConfig } from '@/lib/data'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: `${siteConfig.appName} - Your Fitness Companion`,
  description: siteConfig.tagline + ' Track runs, master exercises with AI body detection, and crush your fitness goals.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='fittrackgo_accent';var v=localStorage.getItem(k);var o=['green','blue','purple','orange','rose'];var a=o.indexOf(v)!==-1?v:'green';document.documentElement.setAttribute('data-accent',a);})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AccentProvider>
          {children}
          <div id="supabase-setup-root" />
          <Toaster position="top-center" richColors closeButton />
          <Analytics />
          </AccentProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
