'use client';

/**
 * @fileoverview Self-attestation modal that gates the lobby and any
 * play-related routes.
 *
 * What this is:
 *   - A client-side modal that blocks render of the wrapped children
 *     until the visitor has actively checked every required box.
 *   - On accept, it writes both `localStorage` (so the user isn't
 *     pestered on every visit) AND a cookie (so server-side endpoints
 *     can verify attestation before processing entry requests).
 *
 * What this is NOT:
 *   - An identity check. We do not collect names, DoB, or documents.
 *     Self-attestation is the deliberate trade-off for not running a
 *     KYC programme on a freeroll product.
 *   - A substitute for the edge geoblock. The proxy still rewrites
 *     blocked regions to /blocked before this modal is ever seen.
 *
 * Versioning:
 *   `ATTESTATION_VERSION` is bumped any time the attestation language
 *   changes materially. Bumping invalidates all existing acceptances
 *   and forces every user to re-attest. Treat bumps as legal events,
 *   not cosmetic ones.
 */

import { useEffect, useState } from 'react';

const ATTESTATION_VERSION = 1;
const STORAGE_KEY = `lounge:attested:v${ATTESTATION_VERSION}`;
const COOKIE_NAME = 'lounge_attested';
const COOKIE_VALUE = `v${ATTESTATION_VERSION}`;
const COOKIE_MAX_AGE_DAYS = 365;

interface StoredAttestation {
  version: number;
  acceptedAt: string;
}

function readStoredAttestation(): StoredAttestation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttestation;
    if (parsed.version !== ATTESTATION_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistAttestation(): void {
  const payload: StoredAttestation = {
    version: ATTESTATION_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_MAX_AGE_DAYS);
  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${COOKIE_NAME}=${COOKIE_VALUE}; ` +
    `expires=${expires.toUTCString()}; ` +
    `path=/; SameSite=Lax${secureFlag}`;
}

interface CheckboxKey {
  key: 'age' | 'region' | 'promo' | 'usPerson' | 'terms';
  label: string;
}

const REQUIRED_CHECKBOXES: ReadonlyArray<CheckboxKey> = [
  {
    key: 'age',
    label:
      'I am at least 18 years old (or 21 where applicable in my region).',
  },
  {
    key: 'region',
    label:
      'I am not currently located in, or accessing this site from, a region the Lounge restricts (sanctioned countries, gambling-restricted countries, or restricted US states).',
  },
  {
    key: 'promo',
    label:
      'I understand the Lounge is freeroll only. Any prizes are promotional appreciation drops awarded at the operator\u2019s discretion - not buy-in winnings, and not a contractual right earned by play.',
  },
  {
    key: 'usPerson',
    label:
      'I am not a US Person for US tax purposes (or, if I am, I accept that I may be excluded from prize distributions to comply with US sanctions and tax rules).',
  },
  {
    key: 'terms',
    label:
      'I have read and accept the Astroid Lounge Terms of Service and Privacy Policy.',
  },
];

export function AgeJurisdictionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [attested, setAttested] = useState(false);

  useEffect(() => {
    setAttested(Boolean(readStoredAttestation()));
    setHydrated(true);
  }, []);

  const handleAccept = () => {
    persistAttestation();
    setAttested(true);
  };

  if (!hydrated) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-[60vh] items-center justify-center text-sm text-[color:var(--color-lounge-text-muted)]"
      >
        Loading the lounge...
      </div>
    );
  }

  if (attested) {
    return <>{children}</>;
  }

  return <AttestationModal onAccept={handleAccept} />;
}

function AttestationModal({ onAccept }: { onAccept: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [decline, setDecline] = useState(false);

  const allChecked = REQUIRED_CHECKBOXES.every((c) => checks[c.key]);

  const toggle = (key: string) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (decline) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <div className="rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-10">
          <h1 className="text-2xl font-semibold">Lounge access not granted</h1>
          <p className="mt-4 text-[color:var(--color-lounge-text-muted)]">
            You declined the door check. The Lounge requires every visitor to
            self-attest to age and region before sitting down. You are welcome
            to browse the parent project at{' '}
            <a
              className="underline"
              href="https://astroid.space"
              target="_blank"
              rel="noreferrer noopener"
            >
              astroid.space
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => setDecline(false)}
            className="mt-8 rounded-md border border-[color:var(--color-lounge-border)] px-4 py-2 text-sm hover:border-[color:var(--color-lounge-accent)]"
          >
            Take me back to the door check
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attestation-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[color:var(--color-lounge-border)] bg-[color:var(--color-lounge-surface)] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--color-lounge-accent)]">
          Door check
        </p>
        <h2
          id="attestation-heading"
          className="mt-2 text-2xl font-semibold leading-tight"
        >
          Before you enter the Lounge
        </h2>
        <p className="mt-3 text-sm text-[color:var(--color-lounge-text-muted)]">
          The Lounge is a freeroll-only community amenity, supported in the
          background by the Astroid project. Confirm the following before we
          let you sit down. None of this is collected as identity - it is a
          self-attestation only.
        </p>

        <ul className="mt-6 space-y-4">
          {REQUIRED_CHECKBOXES.map((c) => (
            <li key={c.key}>
              <label className="flex cursor-pointer gap-3 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  checked={Boolean(checks[c.key])}
                  onChange={() => toggle(c.key)}
                  className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer accent-[color:var(--color-lounge-accent)]"
                />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => setDecline(true)}
            className="rounded-md border border-[color:var(--color-lounge-border)] px-5 py-2.5 text-sm text-[color:var(--color-lounge-text-muted)] hover:text-[color:var(--color-lounge-text)]"
          >
            I do not consent
          </button>
          <button
            type="button"
            disabled={!allChecked}
            onClick={onAccept}
            className="rounded-md bg-[color:var(--color-lounge-accent)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-lounge-bg)] transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-[color:var(--color-lounge-accent-deep)]"
          >
            I confirm and enter
          </button>
        </div>

        <p className="mt-6 text-xs text-[color:var(--color-lounge-text-muted)]">
          Reviewed our terms? See{' '}
          <a className="underline" href="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="underline" href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          . By entering you also accept the parent project&apos;s{' '}
          <a
            className="underline"
            href="https://astroid.space/guidelines"
            target="_blank"
            rel="noreferrer noopener"
          >
            Community Guidelines
          </a>
          .
        </p>
      </div>
    </div>
  );
}
