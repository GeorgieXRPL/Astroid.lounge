import type { Metadata } from 'next';
import { config } from '../lib/config';

export const metadata: Metadata = {
  title: 'Region not supported',
  robots: { index: false, follow: false },
};

const TIER_COPY: Record<string, { heading: string; detail: string }> = {
  '1': {
    heading: 'Service unavailable in your region (sanctions)',
    detail:
      'Your country is on the OFAC sanctions list. We cannot provide ' +
      'this service to you, and there is no appeal channel. This is a ' +
      'legal restriction, not a Lounge policy.',
  },
  '2': {
    heading: 'Service unavailable in your region (gambling regulation)',
    detail:
      'Your country has rules around online gaming products that we ' +
      'have chosen not to operate within. The Lounge is freeroll-only, ' +
      'but the operator stays out of regions where free-to-play is ' +
      'still treated as regulated gaming.',
  },
  '3': {
    heading: 'Service unavailable in your US state',
    detail:
      'Your state takes a strict view of sweepstakes-style and freeroll ' +
      'games. The Lounge is freeroll-only and never accepts purchases, ' +
      'but we still respect state-level operator policy and block here.',
  },
};

interface BlockedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlockedPage({ searchParams }: BlockedPageProps) {
  const params = await searchParams;
  const tierParam = typeof params.tier === 'string' ? params.tier : '2';
  const cc = typeof params.cc === 'string' ? params.cc : '';
  const rc = typeof params.rc === 'string' ? params.rc : '';
  const copy = TIER_COPY[tierParam] ?? TIER_COPY['2'];

  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <div className="rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-danger)]">
          Region not supported
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{copy.heading}</h1>
        <p className="mt-6 text-[color:var(--color-lounge-text-muted)]">
          {copy.detail}
        </p>

        {cc && (
          <p className="mt-6 text-xs text-[color:var(--color-lounge-text-muted)]">
            Detected region: <span className="font-mono">{cc}</span>
            {rc && <> / <span className="font-mono">{rc}</span></>}
          </p>
        )}

        <hr className="my-8 border-[color:var(--color-lounge-border)]" />

        <h2 className="text-base font-semibold">Think this is wrong?</h2>
        <p className="mt-3 text-sm text-[color:var(--color-lounge-text-muted)]">
          If you are not in a blocked region (for example, you are using a VPN
          for unrelated reasons and our edge picked up the wrong location), you
          can email{' '}
          <a className="underline" href={`mailto:${config.emails.support}`}>
            {config.emails.support}
          </a>
          . Please do not attempt to bypass this block - using a VPN to access
          a service that is restricted in your real location is a violation of
          our terms.
        </p>

        <p className="mt-6 text-xs text-[color:var(--color-lounge-text-muted)]">
          You can still browse the parent project at{' '}
          <a
            className="underline"
            href={config.parentProject.site}
            target="_blank"
            rel="noreferrer noopener"
          >
            {config.parentProject.site}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
