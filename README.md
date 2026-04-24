# Astroid Lounge

> Token-gated freeroll poker for the Astroid community. No buy-ins. No fiat. No rake.

This is a **separate brand** from [astroid.space](https://astroid.space). The Lounge is supported in the background by the Astroid project but operates as its own product so that:

1. The main Astroid brand stays charity-first and kid-safe.
2. The Lounge can be moved into a different legal entity later without a code rewrite.
3. Anyone visiting the Lounge sees a clear, dedicated product (not a poker bolt-on to a children's project).

## Why a "freeroll lounge" rather than a real-money poker site?

Online poker for real money is a heavily regulated product almost everywhere on Earth. It requires gaming licences, custody, AML/KYC, dispute systems, and ongoing compliance. None of that is compatible with a community-run amenity.

Instead, the Lounge implements **Model A - Pure Freeroll**:

- Players never pay to enter.
- Holding `$ASTROID` (the project token) is the only entry requirement.
- Prize pools are funded by the **Astroid project treasury**, not by player money.
- The Lounge never custody-holds your wallet. Prize payouts are signed by an out-of-band hardware wallet flow run by the operator.

This places the Lounge alongside other "play for fun, win sponsor-funded prizes" community events rather than alongside regulated gambling products.

## What still needs to happen before launch

A gaming-aware lawyer needs to confirm Model A works in your operator's jurisdiction. Even freeroll poker can be treated as regulated gaming in some places (notably France and Singapore), and US states diverge sharply on sweepstakes rules. The geoblock list in [`app/lib/geoblock.ts`](app/lib/geoblock.ts) is a conservative starting point, **not** a substitute for legal review.

## Architecture (one-paragraph version)

Next.js 16 (App Router, React 19) on Vercel, with Cloudflare in front. The poker engine is ported from MyDexx (`app/lib/poker-engine/`) - five files, ~133KB of pure logic, no MyDexx-specific dependencies. Edge proxy in [`proxy.ts`](proxy.ts) does geoblocking + security headers. Token-gate logic in [`app/lib/tokenGate.ts`](app/lib/tokenGate.ts) reads `$ASTROID` balances via Solana web3.js. Prize-pool service in [`app/lib/prizePool.ts`](app/lib/prizePool.ts) reads the treasury wallet for "what's funded right now". Supabase stores tournaments, entries, and hand history (schema in [`supabase/schema.sql`](supabase/schema.sql)).

```
Request -> Cloudflare (DNS + DDoS) -> Vercel edge proxy (geoblock + headers)
        -> Next.js app (lobby, table UI, admin)
        -> Server actions / route handlers
              -> Supabase (state + audit) + Solana RPC (token-gate reads only)
```

## Project layout

```
app/
  api/health/             liveness endpoint
  blocked/                geo-block landing page
  lobby/                  tournament lobby (gated by attestation modal)
    layout.tsx            wraps children in <AgeJurisdictionGate>
  terms/                  Terms of Service - PLACEHOLDER, awaiting legal
  privacy/                Privacy Policy - PLACEHOLDER, awaiting legal
  components/
    AgeJurisdictionGate.tsx   self-attestation modal (5 required boxes)
  lib/
    branding.ts           Lounge brand strings (separate from Astroid main)
    config.ts             typed env access; freeroll-only enforced here
    geoblock.ts           Tier 1/2/3 country + US state lists
                          (NZ + UK + AU blocked due to operator residency)
    logger.ts             ported from MyDexx (production-safe logger)
    prizePool.ts          treasury balance + tournament prize math
    solana.ts             SPL token balance reads (no signing)
    supabase.ts           server + browser Supabase clients
    tokenGate.ts          $ASTROID balance gate
    validation.ts         ported from MyDexx (zod schemas)
    poker-engine/         ported as-is from MyDexx (CardUtils, GameEngine,
                          HandManager, PokerLogic, StateValidator)
    services/             PokerService (rewritten to drop the MyDexx
                          RewardService dependency)
  layout.tsx              shared chrome (header / footer / disclaimers)
  page.tsx                landing page
proxy.ts                  Next.js 16 proxy (geoblock + security headers)
programs/                 Solana Anchor scaffold (NOT FOR DEPLOY)
  README.md               pre-deploy checklist and rationale
  astroid-lounge-payouts/ on-chain promotional drop payouts
supabase/schema.sql       database schema for fresh Supabase project
Anchor.toml + Cargo.toml  Anchor workspace config (root)
.env.example              required environment variables
```

## Door check + promotional framing

Two trust-and-safety pieces shipped beyond geoblocking:

1. **Self-attestation modal** in [`app/components/AgeJurisdictionGate.tsx`](app/components/AgeJurisdictionGate.tsx). Wraps `/lobby/*` and any future play routes. Visitor must check five boxes (age, region, promotional understanding, US-Person status, ToS acceptance) before render. Sets a versioned cookie + localStorage entry; bumping `ATTESTATION_VERSION` re-prompts everyone.

2. **Promotional-drop language** across the site. The Lounge does not refer to "winnings" or "prizes earned"; everything is framed as **promotional appreciation drops awarded at the operator's discretion**. The wording lives in [`app/lib/branding.ts`](app/lib/branding.ts) (one source) and routes through every page that mentions money. This wording matters legally - see `/terms` for the framework once counsel reviews it.

## Optional: on-chain payouts

The `programs/` directory holds an Anchor scaffold for trust-minimised drop payouts. **It is not deployed and must not be deployed without an audit.** See [`programs/README.md`](programs/README.md) for the pre-deploy checklist. The Next.js app builds and runs without any Solana toolchain installed - the Anchor scaffold is opt-in for whoever picks up the on-chain payout work later.

## Local development

```bash
# 1. Copy env template
cp .env.example .env.local
# Fill in: SUPABASE_*, TREASURY_WALLET, ADMIN_TOKEN, ADMIN_COOKIE_SECRET

# 2. Install
npm install

# 3. Run the database migrations against your Supabase project
#    (paste supabase/schema.sql into the SQL editor)

# 4. Boot the dev server
npm run dev
```

The lobby will boot empty until you insert a tournament row in Supabase. Use the SQL editor:

```sql
insert into poker_tournaments (
  name, starts_at, registration_closes_at,
  prize_pool_amount, prize_pool_currency,
  entry_token_min_balance,
  status, payout_structure
) values (
  'Inaugural community freeroll',
  now() + interval '7 days',
  now() + interval '6 days 23 hours',
  500, 'USDC',
  10000,
  'scheduled',
  '[0.5, 0.3, 0.2]'::jsonb
);
```

## Geoblocking - how to extend

Two layers, both editable without a code change:

1. **Per-tournament**: not yet exposed in the schema (planned for v2).
2. **Operator policy**: set `GEOBLOCK_EXTRA_COUNTRIES` or `GEOBLOCK_EXTRA_US_STATES` in the env.

Permanent additions belong in [`app/lib/geoblock.ts`](app/lib/geoblock.ts). Re-check the OFAC list quarterly.

## What's intentionally NOT in this codebase

- **Deposit / withdraw routes**. The Lounge is freeroll. There is no money-in or money-out path. The MyDexx file `api/poker/wallet/withdraw.ts` was deliberately not ported.
- **Fiat onboarding**. No Stripe, no fiat ramp.
- **Encrypted hot wallets**. The Lounge does not custody funds, so it does not implement `crypto.ts`'s key-management routines from MyDexx.
- **Reward service** (DEX trading rewards). MyDexx's `RewardService.ts` was tied to a perps-trading product that doesn't exist here.
- **Affiliate / referral payouts**. The Lounge does not pay user-acquisition rewards.

If you find yourself adding any of the above, stop and reread this section. Crossing those lines turns the Lounge from a community amenity into a regulated gaming operator overnight.

## Contact

- General: `support@astroid.space`
- Misuse / abuse / brand misrepresentation: `security@astroid.space`

The parent project's [Community Guidelines](https://astroid.space/guidelines) apply to the Lounge as well.
