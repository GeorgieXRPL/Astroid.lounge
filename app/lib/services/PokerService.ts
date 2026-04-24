/**
 * @fileoverview Service-layer convenience wrapper for the poker engine.
 *
 * The original MyDexx version of this file pulled in a `RewardService`
 * (wired to DEX-trade rewards) which is irrelevant to the Lounge build.
 * Here we keep only the pieces that belong in a token-gated freeroll
 * lounge: balance lookups, hand history, and tournament-state reads.
 *
 * Real money never enters the Lounge - this service must NEVER expose a
 * deposit, withdraw, or fiat path. If a future maintainer reaches for
 * `withdraw()`, they should add a sister service in a sibling brand
 * (see plan/Astroid-Poker-Lounge for the architectural rationale).
 */
import { getSupabase } from '../supabase';

/**
 * Read a player's in-tournament chip balance for a given game. Returns
 * `0` when the player isn't seated, which is the correct semantic for
 * the Lounge: balance equals their stake at the table.
 */
export async function getPlayerChipBalance(
  gameId: string,
  walletAddress: string,
): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('poker_players')
    .select('chips')
    .eq('game_id', gameId)
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) throw error;
  return data?.chips ?? 0;
}

/**
 * Pull a player's hand history for display in the lobby (read-only).
 * Capped at `limit` to keep the payload sane on a public endpoint.
 */
export async function getPlayerHandHistory(
  walletAddress: string,
  limit = 50,
): Promise<unknown[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('poker_hands')
    .select('*')
    .contains('player_wallets', [walletAddress])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
