/**
 * Terms of Service - PLACEHOLDER STUB.
 *
 * Every paragraph here is a structural skeleton for the operator's
 * lawyer to fill in. None of this should be treated as legal text in
 * its current state. The visible PLACEHOLDER markers exist to make
 * sure no one ships this page to production unreviewed.
 *
 * The structure mirrors what a NZ-resident operator running a
 * Pr\u00f3spera-registered freeroll product is likely to need: clear
 * promotional-drop framing, consideration disclaimer, geographic
 * scope, dispute resolution, and operator identity (filled in once
 * the entity name and licence are confirmed).
 */
import type { Metadata } from 'next';
import { branding } from '../lib/branding';
import { config } from '../lib/config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms of Service for ${branding.productName}.`,
  robots: { index: false, follow: false }, // PLACEHOLDER - flip to indexable once legal-reviewed
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PlaceholderBanner />

      <header className="mt-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-accent)]">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold">
          Terms of Service
        </h1>
        <p className="text-sm text-[color:var(--color-lounge-text-muted)]">
          Last updated: <Placeholder>[DATE]</Placeholder>
        </p>
      </header>

      <Section title="1. Who operates the Lounge">
        <p>
          The Astroid Lounge is operated by{' '}
          <Placeholder>[OPERATING ENTITY NAME], registered in [JURISDICTION]</Placeholder>{' '}
          (the &quot;Operator&quot;). Contact: {' '}
          <a className="underline" href={`mailto:${config.emails.support}`}>
            {config.emails.support}
          </a>
          .
        </p>
        <p>
          The Lounge is supported in the background by the Astroid project
          (astroid.space). The two are distinct brands. Use of the Lounge
          does not create any legal relationship with the Astroid project or
          any other party.
        </p>
      </Section>

      <Section title="2. What the Lounge is, and what it is not">
        <p>
          The Lounge is a token-gated freeroll poker product. It is freeroll
          only: you do not pay to enter, the Operator does not collect
          buy-ins, fees, or rake, and no purchase is necessary to play.
        </p>
        <p>
          The Lounge is <strong>not</strong> a casino, sportsbook, or
          regulated gambling operator. It is <strong>not</strong> a charity
          or non-profit. It is <strong>not</strong> affiliated with any
          hospital, foundation, or third-party brand it has not explicitly
          named.
        </p>
      </Section>

      <Section title="3. Promotional appreciation drops">
        <p>
          Any prizes you receive at the Lounge are{' '}
          <strong>promotional appreciation drops</strong>, not winnings.
          Drops are sponsored by the Astroid project treasury and are paid
          at the Operator&apos;s sole and absolute discretion. Drops are not
          contractual winnings, are not earned by play, and may be paused,
          modified, or cancelled at any time without notice.
        </p>
        <p>
          Holding $ASTROID is the Lounge&apos;s eligibility signal but is{' '}
          <strong>not</strong> consideration paid to the Operator. The
          Operator does not collect, consume, lock, or otherwise take custody
          of your $ASTROID balance.
        </p>
      </Section>

      <Section title="4. Eligibility and self-attestation">
        <p>You are eligible to use the Lounge only if:</p>
        <ul className="ml-6 list-disc space-y-1">
          <li>You are at least 18 (or 21 where applicable in your region).</li>
          <li>
            You are not currently located in, or accessing the Lounge from, a
            region restricted by{' '}
            <Placeholder>[OPERATOR POLICY OR APPLICABLE LAW]</Placeholder>.
          </li>
          <li>
            You are not subject to any sanctions list (OFAC, UN, EU, UK, AU).
          </li>
          <li>
            You are not a US Person for tax purposes, or, if you are, you
            accept that you may be excluded from drops to maintain
            compliance.
          </li>
        </ul>
        <p>
          You self-attest to the above each time you enter the Lounge through
          the door check. The Operator does not verify identity, age, or
          location independently.
        </p>
      </Section>

      <Section title="5. Geographic restrictions">
        <p>
          The Lounge is geo-blocked at the network edge. Restricted regions
          include OFAC-sanctioned countries, jurisdictions where free-to-play
          gaming is treated as regulated gambling, and certain US states.
          See the{' '}
          <Placeholder>[CURRENT REGION LIST URL]</Placeholder>.
        </p>
        <p>
          Attempting to bypass the geo-block (including via VPN) is a
          violation of these Terms and immediately disqualifies you from
          any current or future drops.
        </p>
      </Section>

      <Section title="6. No custody">
        <p>
          The Lounge never custody-holds your wallet or your $ASTROID. All
          eligibility checks are read-only against the Solana mainnet. Drop
          payments are signed by the Operator out-of-band; you receive them
          to your own self-custody wallet.
        </p>
      </Section>

      <Section title="7. Acceptable use">
        <p>You agree not to:</p>
        <ul className="ml-6 list-disc space-y-1">
          <li>Use bots, scripts, or automation at the tables.</li>
          <li>Collude with other players or share hole-card information.</li>
          <li>Misrepresent the Lounge&apos;s relationship to any third party.</li>
          <li>
            Attempt to access the Lounge from a restricted region by any
            means.
          </li>
        </ul>
        <p>
          The Operator may exclude any account from drops at its sole
          discretion if it suspects any of the above.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          The Lounge&apos;s code, branding, and content are the property of
          the Operator or used under licence. The poker engine is derived
          from open-source software with attribution maintained in the
          repository. The parent Astroid brand and Liv&apos;s drawing are
          the property of the Astroid project and are not used by the
          Lounge except by reference.
        </p>
      </Section>

      <Section title="9. Disclaimers and limitation of liability">
        <p>
          The Lounge is provided <strong>&quot;as is&quot;</strong> and
          <strong> &quot;as available&quot;</strong>. The Operator disclaims
          all warranties to the maximum extent permitted by law. The Operator
          is not liable for any consequential, incidental, special, or
          punitive damages arising from your use of the Lounge.{' '}
          <Placeholder>[CAP ON DIRECT DAMAGES PER LEGAL ADVICE]</Placeholder>
        </p>
      </Section>

      <Section title="10. Governing law and dispute resolution">
        <p>
          These Terms are governed by the laws of{' '}
          <Placeholder>[GOVERNING LAW JURISDICTION]</Placeholder>. Any
          dispute will be resolved by{' '}
          <Placeholder>[ARBITRATION FORUM / COURT VENUE]</Placeholder>.
        </p>
      </Section>

      <Section title="11. Changes to these Terms">
        <p>
          We may update these Terms from time to time. The {' '}
          <em>&quot;Last updated&quot;</em> date at the top will reflect the
          latest revision. Material changes will trigger a re-attestation at
          the door check.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          General questions:{' '}
          <a className="underline" href={`mailto:${config.emails.support}`}>
            {config.emails.support}
          </a>
          . Abuse, brand-misuse, or security:{' '}
          <a className="underline" href={`mailto:${config.emails.security}`}>
            {config.emails.security}
          </a>
          .
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
