/**
 * Privacy Policy - PLACEHOLDER STUB.
 *
 * Same disclaimer as /terms: this is structural scaffolding for the
 * Operator's lawyer to fill in. The Lounge minimises personal data
 * collection by design (no KYC, self-attestation only, wallet
 * addresses are pseudonymous), so the policy is intentionally short.
 */
import type { Metadata } from 'next';
import { branding } from '../lib/branding';
import { config } from '../lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy Policy for ${branding.productName}.`,
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PlaceholderBanner />

      <header className="mt-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-accent)]">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold">
          Privacy Policy
        </h1>
        <p className="text-sm text-[color:var(--color-lounge-text-muted)]">
          Last updated: <Placeholder>[DATE]</Placeholder>
        </p>
      </header>

      <Section title="1. Who is the data controller">
        <p>
          The data controller is{' '}
          <Placeholder>[OPERATING ENTITY NAME], registered in [JURISDICTION]</Placeholder>.
          Privacy contact:{' '}
          <a className="underline" href={`mailto:${config.emails.security}`}>
            {config.emails.security}
          </a>
          .
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          The Lounge is designed to collect as little personal data as is
          technically possible. Specifically, we collect:
        </p>
        <ul className="ml-6 list-disc space-y-1">
          <li>
            <strong>Your Solana wallet address.</strong> Pseudonymous, not
            tied to your real-world identity by us.
          </li>
          <li>
            <strong>Self-attestation flags</strong> (age, region, US-Person
            status). Stored locally in your browser and as a cookie; not
            associated with a personal identifier.
          </li>
          <li>
            <strong>Tournament participation records.</strong> Wallet,
            tournament ID, position, and any drop awarded - retained for
            audit and dispute resolution.
          </li>
          <li>
            <strong>Network metadata</strong> (IP-derived country/region for
            geoblocking, browser user-agent, request timestamps). Used at
            the edge and discarded; we do not log raw IP addresses.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> collect: names, dates of birth,
          government IDs, KYC documents, payment-card data, fiat banking
          details, or biometrics.
        </p>
      </Section>

      <Section title="3. What we do not do">
        <ul className="ml-6 list-disc space-y-1">
          <li>We do not sell your data. To anyone. Ever.</li>
          <li>We do not run third-party advertising trackers.</li>
          <li>
            We do not link your wallet address to any off-platform identity
            without your explicit consent.
          </li>
          <li>
            We do not retain raw IP addresses beyond the edge layer&apos;s
            processing of a request.
          </li>
        </ul>
      </Section>

      <Section title="4. Where data is processed">
        <p>
          The Lounge runs on{' '}
          <Placeholder>[INFRA PROVIDERS - e.g. Vercel + Cloudflare + Supabase]</Placeholder>.
          Data may be processed in the regions those providers operate. We
          do not control where each request is routed by our CDN.
        </p>
      </Section>

      <Section title="5. Cookies and local storage">
        <p>
          We use one strictly-necessary cookie (
          <code>lounge_attested</code>) to remember your door-check
          attestation. We do not use analytics cookies, advertising cookies,
          or third-party trackers.
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You have the right to request deletion of any personal data we
          hold about you. Because we collect so little, this typically
          means deleting your tournament-history rows from our database,
          which we will do within{' '}
          <Placeholder>[TIME LIMIT - e.g. 30 days]</Placeholder> of a
          verified request to{' '}
          <a className="underline" href={`mailto:${config.emails.security}`}>
            {config.emails.security}
          </a>
          .
        </p>
        <p>
          Note that deletion does not extend to on-chain records (Solana
          transactions, token balances) which are public and immutable by
          design.
        </p>
      </Section>

      <Section title="7. Children">
        <p>
          The Lounge is not intended for and not directed at anyone under
          18. We do not knowingly collect data from minors. If you become
          aware that a minor has used the Lounge, please contact{' '}
          <a className="underline" href={`mailto:${config.emails.security}`}>
            {config.emails.security}
          </a>{' '}
          and we will delete their records.
        </p>
      </Section>

      <Section title="8. Changes to this policy">
        <p>
          Material changes trigger a re-attestation at the door check, so
          you will see them before your next session.
        </p>
      </Section>

      <PlaceholderBanner footer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 space-y-4 text-sm leading-relaxed text-[color:var(--color-lounge-text-muted)]">
      <h2 className="text-lg font-semibold text-[color:var(--color-lounge-text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[color:var(--color-lounge-danger)]/15 px-1.5 py-0.5 font-mono text-xs text-[color:var(--color-lounge-danger)]">
      {children}
    </span>
  );
}

function PlaceholderBanner({ footer = false }: { footer?: boolean }) {
  return (
    <div
      className={`rounded-md border-2 border-dashed border-[color:var(--color-lounge-danger)] bg-[color:var(--color-lounge-danger)]/10 p-4 text-sm text-[color:var(--color-lounge-text)] ${
        footer ? 'mt-12' : ''
      }`}
    >
      <strong className="text-[color:var(--color-lounge-danger)]">
        PLACEHOLDER - awaiting legal review.
      </strong>{' '}
      This document is a structural stub. It is not legal text, has not
      been reviewed by counsel, and must not be relied upon. The Operator
      will publish a counsel-reviewed version before the Lounge accepts
      any traffic.
    </div>
  );
}
