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
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
