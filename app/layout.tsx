import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import { Toaster } from 'sonner'
import { strings } from '@/lib/strings'
import './globals.css'

/** Heebo covers Hebrew properly. Hebrew and RTL are the default, not a wrapper. */
const hebrew = Heebo({
  variable: '--font-hebrew',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: strings.app.title,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${hebrew.variable} h-full antialiased`}>
      {/*
        * suppressHydrationWarning is for BROWSER EXTENSIONS, not for anything
        * this app renders.
        *
        * Extensions attach attributes to <body> before React hydrates —
        * ColorZilla adds `cz-shortcut-listen="true"`, password managers and
        * translators add their own — and React then reports a mismatch against
        * markup the server never produced. Nothing here can prevent that; the
        * attribute arrives before our code runs.
        *
        * It applies to THIS element's own attributes and text only, one level
        * deep: it does not silence mismatches in any child. Since <body> renders
        * a constant className and nothing else, there is nothing real left for
        * it to hide.
        */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
