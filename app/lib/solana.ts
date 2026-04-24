/**
 * @fileoverview Lightweight Solana RPC helpers for the Lounge.
 *
 * Scope is intentionally narrow: read public balances. The Lounge does
 * NOT custody, sign, or move funds. Prize payouts are signed by an
 * out-of-band hardware wallet flow you control - this module only
 * supports the token-gate read and the (read-only) treasury check.
 */
import {
  Connection,
  PublicKey,
  type Commitment,
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { config } from './config';

let cachedConnection: Connection | null = null;

export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Connection(config.solana.rpcUrl, commitment);
  return cachedConnection;
}

/**
 * Read a wallet's $ASTROID balance, denominated in raw token units
 * (i.e. accounting for `decimals`). Returns `0` if the holder doesn't
 * have an associated token account yet.
 */
export async function getAstroidBalance(walletAddress: string): Promise<number> {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(config.token.mint);
    const ata = getAssociatedTokenAddressSync(mint, wallet);

    const conn = getConnection();
    const balance = await conn.getTokenAccountBalance(ata);

    return Number(balance.value.uiAmount ?? 0);
  } catch (err) {
    if (err instanceof Error && err.message.includes('could not find account')) {
      return 0;
    }
    throw err;
  }
}

/**
 * Read the treasury wallet's USDC (or other prize-mint) balance for the
 * lobby's "current prize pool" indicator. Returns `0` if the treasury
 * isn't configured or the ATA doesn't exist.
 */
export async function getTreasuryPrizeBalance(): Promise<number> {
  if (!config.treasury.walletAddress) return 0;

  try {
    const wallet = new PublicKey(config.treasury.walletAddress);
    const mint = new PublicKey(config.treasury.prizePoolMint);
    const ata = getAssociatedTokenAddressSync(mint, wallet);

    const conn = getConnection();
    const balance = await conn.getTokenAccountBalance(ata);

    return Number(balance.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}
