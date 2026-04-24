/**
 * Liveness endpoint. Cheap; no external calls. Used by uptime monitors
 * + the Cloudflare healthcheck. Don't add Supabase or RPC reads here -
 * those belong in a separate `/api/health/deep` route so a cold RPC
 * doesn't take the whole site down in the monitor's eyes.
 */
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'astroid-lounge',
    ts: new Date().toISOString(),
  });
}
