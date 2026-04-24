/**
 * @fileoverview Next.js edge middleware - applied on every request.
 *
 * Two jobs:
 *   1. Geoblocking. Read the country/region headers attached by Vercel
 *      / Cloudflare, evaluate against `geoblock.ts`, and either allow
 *      the request through or rewrite to `/blocked`.
 *   2. Security headers. Strict CSP, no framing, referrer policy,
 *      permissions-policy locked down. Anything embedded in an iframe
 *      should be impossible (this matters when bad actors try to
 *      reframe the Lounge under a phishing brand).
 *
 * What this middleware does NOT do:
 *   - Authenticate users. The token-gate is enforced in API routes
 *     when the user actually tries to enter a tournament.
 *   - VPN detection. That's a separate (paid) service plugged into
 *     the entry endpoint, not edge middleware.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { evaluateGeoBlock } from './app/lib/geoblock';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|blocked|.well-known/).*)',
  ],
};

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

function readGeo(request: NextRequest): {
  countryCode: string | null;
  regionCode: string | null;
} {
  const cf = {
    country: request.headers.get('cf-ipcountry'),
    region: request.headers.get('cf-region-code'),
  };
  if (cf.country) {
    return { countryCode: cf.country, regionCode: cf.region };
  }

  const vercel = {
    country: request.headers.get('x-vercel-ip-country'),
    region: request.headers.get('x-vercel-ip-country-region'),
  };
  if (vercel.country) {
    return { countryCode: vercel.country, regionCode: vercel.region };
  }

  return { countryCode: null, regionCode: null };
}

export function proxy(request: NextRequest) {
  const geo = readGeo(request);
  const decision = evaluateGeoBlock(geo);

  if (decision.blocked) {
    const url = request.nextUrl.clone();
    url.pathname = '/blocked';
    url.searchParams.set('tier', String(decision.tier ?? 'unknown'));
    url.searchParams.set('reason', decision.reason ?? 'policy');
    if (decision.countryCode) url.searchParams.set('cc', decision.countryCode);
    if (decision.regionCode) url.searchParams.set('rc', decision.regionCode);

    const response = NextResponse.rewrite(url);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(k, v);
    }
    return response;
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  if (decision.countryCode) {
    response.headers.set('x-lounge-cc', decision.countryCode);
  }
  if (decision.regionCode) {
    response.headers.set('x-lounge-rc', decision.regionCode);
  }
  return response;
}
