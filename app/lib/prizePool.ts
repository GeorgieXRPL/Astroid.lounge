/**
 * @fileoverview Prize-pool service skeleton.
 *
 * Architectural intent (read this before extending):
 *
 * 1. Prize pools are funded from the Astroid project treasury wallet.
 *    Players' $ASTROID balances are NEVER consumed; the gate is purely
 *    a "do you hold the token?" check.
 * 2. The Lounge READS the treasury balance to display "this season's
 *    pool" but never SIGNS transactions. Payouts are executed
 *    out-of-band by the operator using a hardware wallet, then recorded
 *    here for audit.
 * 3. Tournament definitions live in the `poker_tournaments` table
 *    (see supabase/schema.sql). This service is the typed, validated
 *    interface to that table.
 */
import { z } from 'zod';
import { getSupabase } from './supabase';
import { getTreasuryPrizeBalance } from './solana';
import { config } from './config';

const tournamentRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  starts_at: z.string(),
  registration_closes_at: z.string(),
  prize_pool_amount: z.number().nonnegative(),
  prize_pool_currency: z.string(),
  status: z.enum(['scheduled', 'registering', 'live', 'completed', 'cancelled']),
  entry_token_min_balance: z.number().nonnegative(),
  max_players: z.number().int().positive(),
  payout_structure: z.array(z.number().nonnegative()),
});

export type Tournament = z.infer<typeof tournamentRowSchema>;

export async function listUpcomingTournaments(limit = 10): Promise<Tournament[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('poker_tournaments')
    .select('*')
    .in('status', ['scheduled', 'registering'])
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => tournamentRowSchema.parse(row));
}

/**
 * Snapshot of available prize liquidity. Used by the lobby to show
 * "treasury currently funds X USDC of pools" without exposing the
 * treasury wallet address directly in the UI.
 */
export async function getTreasurySnapshot(): Promise<{
  fundedAmount: number;
  currency: string;
  walletConfigured: boolean;
}> {
  const fundedAmount = await getTreasuryPrizeBalance();
  return {
    fundedAmount,
    currency: 'USDC',
    walletConfigured: Boolean(config.treasury.walletAddress),
  };
}

/**
 * Compute the per-place payout array for a finalised tournament. The
 * tournament's `payout_structure` is stored as fractions summing to 1
 * (e.g. `[0.5, 0.3, 0.2]`); this function multiplies through the prize
 * pool and rounds to integer cents.
 */
export function computePayouts(t: Tournament): number[] {
  const total = t.prize_pool_amount;
  return t.payout_structure.map((fraction) =>
    Math.round(total * fraction * 100) / 100,
  );
}
