/**
 * @fileoverview Geo-blocking ruleset for the Astroid Lounge.
 *
 * Three tiers, in escalating risk:
 *
 *   - Tier 1 (HARD-BLOCK):  OFAC-sanctioned countries. Always blocked,
 *                            no exceptions, no over-21 bypass. These
 *                            are export-control / sanctions issues, not
 *                            gambling regulation.
 *
 *   - Tier 2 (HARD-BLOCK):  Countries with strict bans on real-money
 *                            online gambling AND on free-to-play
 *                            sweepstakes-style games. The Lounge is
 *                            freeroll, but operators in these regions
 *                            still face risk - we block to be safe.
 *
 *   - Tier 3 (US states):   Sweepstakes-prohibited / strict states.
 *                            Even though the Lounge has no purchase
 *                            mechanic, states like Washington and
 *                            Idaho take a maximalist view; block.
 *
 * This module only DEFINES the rules. The proxy.ts middleware applies
 * them on every request, and `app/blocked/page.tsx` shows the user a
 * clear message + appeal contact.
 *
 * Adjust via env (`GEOBLOCK_EXTRA_COUNTRIES`, `GEOBLOCK_EXTRA_US_STATES`)
 * before changing this file - that's the fast path for legal updates.
 */

/**
 * ISO 3166-1 alpha-2 country codes - OFAC-sanctioned. Source:
 * https://ofac.treasury.gov/sanctions-programs-and-country-information
 * (synthesised list, current as of 2026-04. Re-check quarterly.)
 */
export const TIER1_OFAC_COUNTRIES: ReadonlySet<string> = new Set([
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'SY', // Syria
  'RU', // Russia (comprehensive sanctions on certain regions; block conservatively)
  'BY', // Belarus
  'MM', // Myanmar / Burma
]);

/**
 * Countries with strict gambling regulation where freeroll-with-prize
 * structures are still risky to operate. Conservative list - tighten
 * with operator's gaming-aware lawyer's advice before launch.
 */
export const TIER2_GAMBLING_RESTRICTED_COUNTRIES: ReadonlySet<string> = new Set([
  'FR', // France - online gaming requires ANJ licence, includes free play
  'PL', // Poland - PolskaGry-type framework
  'TR', // Turkey - blanket prohibition
  'SG', // Singapore - Remote Gambling Act
  'HK', // Hong Kong - Gambling Ordinance
  'TH', // Thailand - blanket prohibition
  'AE', // UAE - blanket prohibition
  'QA', // Qatar - blanket prohibition
  'SA', // Saudi Arabia - blanket prohibition
  'MA', // Morocco - heavy restriction
  'EG', // Egypt - heavy restriction
  'PK', // Pakistan - heavy restriction
  'IN', // India - state-by-state but major risk; block at country level
]);

/**
 * US state codes (USPS abbreviations) where freeroll / sweepstakes
 * operators have faced enforcement. Players from these states are
 * blocked even though the rest of the US is allowed.
 */
export const TIER3_BLOCKED_US_STATES: ReadonlySet<string> = new Set([
  'WA', // Washington - explicit anti-online-gambling law, sweepstakes-aggressive
  'ID', // Idaho - sweepstakes-aggressive
  'NV', // Nevada - any gaming product needs Nevada licensure
  'NY', // New York - DFS-style enforcement against sweepstakes
  'MI', // Michigan - regulated gaming framework, sweepstakes scrutiny
]);

export interface GeoBlockDecision {
  blocked: boolean;
  tier?: 1 | 2 | 3;
  reason?: string;
  countryCode?: string;
  regionCode?: string;
}

export interface GeoSignal {
  countryCode?: string | null;
  regionCode?: string | null;
}

function envSet(envVar: string): Set<string> {
  const raw = process.env[envVar] ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function evaluateGeoBlock(signal: GeoSignal): GeoBlockDecision {
  const country = (signal.countryCode ?? '').toUpperCase();
  const region = (signal.regionCode ?? '').toUpperCase();

  if (!country) {
    return { blocked: false };
  }

  if (TIER1_OFAC_COUNTRIES.has(country)) {
    return {
      blocked: true,
      tier: 1,
      reason: 'sanctions',
      countryCode: country,
    };
  }

  const extraCountries = envSet('GEOBLOCK_EXTRA_COUNTRIES');
  if (extraCountries.has(country)) {
    return {
      blocked: true,
      tier: 2,
      reason: 'operator-policy',
      countryCode: country,
    };
  }

  if (TIER2_GAMBLING_RESTRICTED_COUNTRIES.has(country)) {
    return {
      blocked: true,
      tier: 2,
      reason: 'gambling-regulation',
      countryCode: country,
    };
  }

  if (country === 'US') {
    const extraStates = envSet('GEOBLOCK_EXTRA_US_STATES');
    if (TIER3_BLOCKED_US_STATES.has(region) || extraStates.has(region)) {
      return {
        blocked: true,
        tier: 3,
        reason: 'state-policy',
        countryCode: country,
        regionCode: region,
      };
    }
  }

  return { blocked: false, countryCode: country, regionCode: region };
}
