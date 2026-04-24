import { branding } from './lib/branding';
import { config } from './lib/config';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <section className="space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-accent)]">
          Community amenity
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight sm:text-6xl">
          {branding.headlineCopy}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[color:var(--color-lounge-text-muted)]">
          {branding.subheadCopy}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
          <a
            href="/lobby"
            className="rounded-md bg-[color:var(--color-lounge-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--color-lounge-bg)] transition hover:bg-[color:var(--color-lounge-accent-deep)]"
          >
            Open the lobby
          </a>
          <a
            href="https://astroid.space"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md border border-[color:var(--color-lounge-border)] px-6 py-3 text-sm text-[color:var(--color-lounge-text)] hover:border-[color:var(--color-lounge-accent)]"
          >
            About the Astroid project
          </a>
        </div>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        <Card
          title="Token-gated entry"
          body={`Hold ${config.token.minBalanceForEntry.toLocaleString()}+ $${config.token.symbol} to register for a community freeroll. Holding the token is not an entry fee - it just signals you are part of the community. No purchase, no buy-in, no rake.`}
        />
        <Card
          title="Promotional drops, not winnings"
          body="Any prizes are promotional appreciation drops sponsored by the Astroid project treasury, awarded at the operator\u2019s discretion. They are not contractual winnings, not earned by play, and may be paused at any time."
        />
        <Card
          title="Geoblocked & age-gated"
          body="Sanctioned and gambling-restricted regions are blocked at the edge. Players self-attest to age and jurisdiction at the door before sitting down."
        />
      </section>

      <section className="mt-20 rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-8">
        <h2 className="text-2xl font-semibold">How the Lounge relates to Astroid</h2>
        <p className="mt-4 text-[color:var(--color-lounge-text-muted)]">
          {branding.parentRelationship}
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)]/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--color-lounge-text-muted)]">
          Promotional disclosure
        </h2>
        <p className="mt-3 text-sm text-[color:var(--color-lounge-text-muted)]">
          {branding.promotionalDisclosure}
        </p>
      </section>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-6">
      <h3 className="text-lg font-semibold text-[color:var(--color-lounge-accent)]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-lounge-text-muted)]">
        {body}
      </p>
    </div>
  );
}
