import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';

import { Providers } from '@/components/layout/providers';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Lotus Peak', template: '%s · Lotus Peak' },
  description: 'The admin panel for Lotus Peak Tours & Travel.',
  /**
   * Belt and braces with the `X-Robots-Tag` header in next.config. A panel
   * holding customers' names, email addresses and telephone numbers should
   * carry the instruction in both places.
   */
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  /**
   * The office answers enquiries on a phone, and a form on a phone means an
   * on-screen keyboard. `maximumScale: 1` would stop somebody zooming in on a
   * field they are struggling to read, which is the accessibility failure this
   * meta tag is famous for.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
