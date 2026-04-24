import type { Metadata } from 'next';
import { config } from './lib/config';
import { branding } from './lib/branding';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(config.site.url),
  title: {
    default: `${branding.productName} - ${branding.productTagline}`,
    template: `%s | ${branding.productName}`,
  },
  description: branding.subheadCopy,
  applicationName: branding.productName,
  authors: [{ name: 'Astroid Lounge' }],
  keywords: ['poker', 'freeroll', 'token-gated', 'community', 'astroid'],
  robots: { index: true, follow: true },
  openGraph: {
    title: branding.productName,
    description: branding.subheadCopy,
    url: config.site.url,
    siteName: branding.productName,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)]/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl font-semibold tracking-tight text-[color:var(--color-lounge-accent)]">
                  Astroid
                </span>
                <span className="text-xl font-light tracking-widest text-[color:var(--color-lounge-text)]">
                  LOUNGE
                </span>
              </a>
              <nav className="hidden gap-6 text-sm text-[color:var(--color-lounge-text-muted)] sm:flex">
                <a href="/lobby" className="hover:text-[color:var(--color-lounge-text)]">
                  Lobby
                </a>
                <a
                  href="https://astroid.space"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-[color:var(--color-lounge-text)]"
                >
                  Parent project
                </a>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)]/60 py-8">
            <div className="mx-auto max-w-6xl space-y-3 px-6 text-xs text-[color:var(--color-lounge-text-muted)]">
              <p>
                <strong className="text-[color:var(--color-lounge-text)]">
                  {branding.productName}
                </strong>{' '}
                is freeroll only. No buy-ins, no fiat, no rake. Any prizes are
                promotional appreciation drops sponsored by the Astroid project
                treasury, awarded at the operator&apos;s discretion. They are not
                contractual winnings.
              </p>
              <p>
                Not a casino. Not a charity. Not affiliated with any hospital.
                Crypto involves risk - holding $ASTROID is not an investment in
                this Lounge.
              </p>
              <p>
                See the{' '}
                <a className="underline" href="/terms">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a className="underline" href="/privacy">
                  Privacy Policy
                </a>{' '}
                for the full promotional-drop framework.
              </p>
              <p>
                Questions? Email{' '}
                <a className="underline" href={`mailto:${config.emails.support}`}>
                  {config.emails.support}
                </a>
                . Concerns about misuse of branding or images? Email{' '}
                <a className="underline" href={`mailto:${config.emails.security}`}>
                  {config.emails.security}
                </a>
                .
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
