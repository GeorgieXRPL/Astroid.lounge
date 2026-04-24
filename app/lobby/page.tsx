import type { Metadata } from 'next';
import { branding } from '../lib/branding';
import { config } from '../lib/config';

export const metadata: Metadata = {
  title: 'Lobby',
  description: `Tournament lobby for ${branding.productName}. Token-gated freeroll only.`,
};

export default function LobbyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-accent)]">
          Lobby - preview
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold">
          Community freerolls
        </h1>
        <p className="max-w-2xl text-[color:var(--color-lounge-text-muted)]">
          The Lounge is in private build. Scheduled community freerolls will
          appear here once the operator opens registration. Hold at least{' '}
          <strong className="text-[color:var(--color-lounge-text)]">
            {config.token.minBalanceForEntry.toLocaleString()} $
            {config.token.symbol}
          </strong>{' '}
          to be eligible. Holding the token is not an entry fee - any
          appreciation drops are promotional and at the operator\u2019s
          discretion.
        </p>
      </header>

      <section className="mt-10 rounded-xl border border-dashed border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)]/40 p-10 text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-lounge-text-muted)]">
          No tournaments scheduled yet
        </p>
        <p className="mt-3 text-[color:var(--color-lounge-text)]">
          Follow{' '}
          <a
            className="underline"
            href="https://astroid.space"
            target="_blank"
            rel="noreferrer noopener"
          >
            astroid.space
          </a>{' '}
          for launch announcements.
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-6 text-sm text-[color:var(--color-lounge-text-muted)]">
        <h2 className="text-base font-semibold text-[color:var(--color-lounge-text)]">
          Before you sit down
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>You must be 18 or older (21+ where applicable).</li>
          <li>
            You must not be in a region the Lounge geoblocks (sanctions
            countries, strict-gambling jurisdictions, certain US states).
          </li>
          <li>
            Holding $ASTROID is the only entry requirement. We do not collect
            buy-ins. Ever.
          </li>
          <li>
            Any prizes are promotional appreciation drops sponsored by the
            project treasury, paid at the operator&apos;s discretion. They are
            not contractual winnings.
          </li>
          <li>
            Drop payouts are signed by the operator out-of-band; the Lounge
            never custody-holds your wallet.
          </li>
        </ul>
      </section>
    </div>
  );
}
