-- =====================================================================
-- Astroid Lounge - core schema
-- =====================================================================
-- Run this against a FRESH Supabase project (not the Astroid main one).
-- Reasoning: keeping the Lounge's data isolated from the main project's
-- production data limits blast radius if the Lounge is ever migrated to
-- a separate legal entity.
--
-- This schema is intentionally minimal for the v1 cut. It supports:
--   - Player onboarding (wallet binding + jurisdiction self-attestation)
--   - Tournaments (scheduled, registration, live, completed)
--   - Players seated at tournaments
--   - Hand history (append-only, audit trail)
--
-- It does NOT support:
--   - Deposits / withdrawals (the Lounge has no money in/money out)
--   - Player-to-player chip transfers
--   - Any fiat or USDC custody
-- These omissions are deliberate. Don't add them without first deciding
-- whether you've crossed into regulated-gambling territory.
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- Players
-- =====================================================================
create table if not exists lounge_players (
  id              uuid primary key default uuid_generate_v4(),
  wallet_address  text not null unique,

  -- Self-attestation captured at the door. Real ID verification is
  -- intentionally NOT collected - we are not running KYC and we don't
  -- want to be a custodian of identity documents.
  age_attested    boolean not null default false,
  jurisdiction_attested text,
  attested_at     timestamptz,

  -- Cached + frequently-accessed display fields. Snapshot of token
  -- balance at last login so the lobby can render gating banners
  -- without an RPC round-trip on every page render.
  display_name    text,
  last_token_balance numeric(20, 6) default 0,
  last_balance_check_at timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists lounge_players_wallet_idx
  on lounge_players (wallet_address);

-- =====================================================================
-- Tournaments
-- =====================================================================
create type lounge_tournament_status as enum (
  'scheduled',
  'registering',
  'live',
  'completed',
  'cancelled'
);

create table if not exists poker_tournaments (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,

  status          lounge_tournament_status not null default 'scheduled',

  starts_at       timestamptz not null,
  registration_closes_at timestamptz not null,
  ended_at        timestamptz,

  -- Funded by the Astroid project treasury. Always denominated in the
  -- prize_pool_currency (USDC by default). Stored as a settled amount,
  -- not a target - the operator must confirm treasury funding before
  -- promoting status from 'scheduled' to 'registering'.
  prize_pool_amount     numeric(20, 6) not null default 0,
  prize_pool_currency   text not null default 'USDC',

  -- Token-gating threshold for ENTRY. Stored per-tournament so we can
  -- run "high-roller freerolls" with a higher minimum without changing
  -- the global config.
  entry_token_min_balance numeric(20, 6) not null,

  max_players     integer not null default 1000,

  -- Ordered fractions summing to 1, e.g. [0.5, 0.3, 0.2]. App-side
  -- code multiplies through prize_pool_amount to compute payouts.
  payout_structure jsonb not null default '[1.0]'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists poker_tournaments_status_starts_idx
  on poker_tournaments (status, starts_at);

-- =====================================================================
-- Tournament registrations (token-gate snapshot)
-- =====================================================================
create table if not exists poker_tournament_entries (
  id              uuid primary key default uuid_generate_v4(),
  tournament_id   uuid not null references poker_tournaments(id) on delete cascade,
  player_id       uuid not null references lounge_players(id) on delete cascade,
  wallet_address  text not null,

  -- The balance we observed at registration time. If the player drops
  -- below the gate after registration, we still let them play - the
  -- snapshot is what matters legally and audit-wise.
  token_balance_at_entry numeric(20, 6) not null,

  registered_at   timestamptz not null default now(),
  finished_position integer,
  payout_amount   numeric(20, 6) default 0,

  unique (tournament_id, player_id)
);

create index if not exists poker_tournament_entries_tournament_idx
  on poker_tournament_entries (tournament_id);

-- =====================================================================
-- Hands (append-only audit log)
-- =====================================================================
-- The full hand state lives wherever the poker engine puts it (in-memory
-- + periodic snapshots). This table is the durable, queryable summary
-- used for the public hand-history view and for dispute resolution.
create table if not exists poker_hands (
  id              uuid primary key default uuid_generate_v4(),
  tournament_id   uuid references poker_tournaments(id) on delete set null,
  hand_number     integer not null,

  player_wallets  text[] not null,
  board_cards     text[] not null default '{}'::text[],

  -- Compressed JSON of the full hand timeline. Schema follows the
  -- engine's HandManager output - see app/lib/poker-engine/HandManager.ts.
  timeline        jsonb not null,

  winner_wallets  text[] not null default '{}'::text[],
  pot_size        numeric(20, 6) not null default 0,

  created_at      timestamptz not null default now()
);

create index if not exists poker_hands_tournament_idx
  on poker_hands (tournament_id, hand_number);
create index if not exists poker_hands_player_gin_idx
  on poker_hands using gin (player_wallets);

-- =====================================================================
-- Audit log (admin actions)
-- =====================================================================
-- Every operator action that touches a tournament or a payout is
-- recorded here. Read-only by app code; insert-only by the admin layer.
create table if not exists lounge_audit_log (
  id              bigserial primary key,
  actor_email     text not null,
  action          text not null,
  target_type     text,
  target_id       text,
  details         jsonb,
  created_at      timestamptz not null default now()
);

-- =====================================================================
-- Row-level security
-- =====================================================================
-- The service-role key bypasses RLS, but we still enable it so that
-- the anon key (used in the browser) cannot read player PII or
-- audit log rows.
alter table lounge_players enable row level security;
alter table poker_tournaments enable row level security;
alter table poker_tournament_entries enable row level security;
alter table poker_hands enable row level security;
alter table lounge_audit_log enable row level security;

-- Public can read tournament listings + completed-hand summaries.
create policy "tournaments are publicly readable"
  on poker_tournaments for select
  using (true);

create policy "hands are publicly readable"
  on poker_hands for select
  using (true);

-- Players can read their own row (when an auth.users row is wired up).
-- Until then this policy denies anon reads, which is what we want.
create policy "players can read self"
  on lounge_players for select
  using (false);

create policy "entries are publicly readable"
  on poker_tournament_entries for select
  using (true);
