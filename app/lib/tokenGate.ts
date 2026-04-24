/**
 * @fileoverview Token-gating decision helpers.
 *
 * The Lounge is a "Pure Freeroll Lounge" (Model A). Players never pay
 * to enter; instead, holding $ASTROID acts as the entry gate. This file
 * centralises the gate so we can change thresholds, snapshot logic, or
 * tier rules in one place.
 *
 * Why not pay-to-enter?
 *   Real-money buy-ins make this a regulated gambling product almost
 *   everywhere. Token-balance gating keeps the Lounge as a community
 *   amenity, not a casino. See plan/Astroid-Poker-Lounge.
 */
import { config } from './config';
import { getAstroidBalance } from './solana';

export type GateResult =
  | {
      allowed: true;
      walletAddress: string;
      balance: number;
      tier: GateTier;
    }
  | {
      allowed: false;
      walletAddress: string;
      balance: number;
      reason: 'below-min-balance' | 'invalid-wallet' | 'rpc-error';
      requiredBalance: number;
    };

export type GateTier = 'starter' | 'regular' | 'whale';

const TIER_THRESHOLDS: Record<GateTier, number> = {
  starter: 0,
  regular: 100_000,
  whale: 1_000_000,
};

function balanceToTier(balance: number): GateTier {
  if (balance >= TIER_THRESHOLDS.whale) return 'whale';
  if (balance >= TIER_THRESHOLDS.regular) return 'regular';
  return 'starter';
}

/**
 * Check whether a wallet is allowed to register for a freeroll
 * tournament. The check is live (no caching) so the operator can
 * adjust the threshold and have it take effect immediately. If you
 * later want snapshot-based entry (balance frozen at registration
 * close), do that here, not at the call site.
 */
export async function checkTokenGate(
  walletAddress: string | null | undefined,
): Promise<GateResult> {
  const required = config.token.minBalanceForEntry;
  const wallet = walletAddress?.trim() ?? '';

  if (!wallet) {
    return {
      allowed: false,
      walletAddress: '',
      balance: 0,
      reason: 'invalid-wallet',
      requiredBalance: required,
    };
  }

  let balance = 0;
  try {
    balance = await getAstroidBalance(wallet);
  } catch {
    return {
      allowed: false,
      walletAddress: wallet,
      balance: 0,
      reason: 'rpc-error',
      requiredBalance: required,
    };
  }

  if (balance < required) {
    return {
      allowed: false,
      walletAddress: wallet,
      balance,
      reason: 'below-min-balance',
      requiredBalance: required,
    };
  }

  return {
    allowed: true,
    walletAddress: wallet,
    balance,
    tier: balanceToTier(balance),
  };
}
