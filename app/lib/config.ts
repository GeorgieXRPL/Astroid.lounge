/**
 * @fileoverview Centralised, typed access to environment + brand config
 * for the Astroid Lounge.
 *
 * Two design rules enforced here:
 *   1. The Lounge is a SEPARATE BRAND from astroid.space. Names, copy,
 *      and contact channels live here independently so that a future
 *      legal carve-out (e.g. moving the Lounge into a different entity)
 *      doesn't require code surgery.
 *   2. Anything money-related must be impossible to enable by accident.
 *      The Lounge is freeroll-only; there is intentionally no
 *      `enableBuyIns` flag, no fiat config, no withdraw route.
 */

const requiredOrEmpty = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

export const config = {
  site: {
    name: 'Astroid Lounge',
    domain: 'lounge.astroid.space',
    url: requiredOrEmpty(
      'NEXT_PUBLIC_SITE_URL',
      'https://lounge.astroid.space',
    ),
    tagline: 'Token-gated freeroll poker for the Astroid community.',
  },

  parentProject: {
    name: 'Astroid',
    site: 'https://astroid.space',
    note:
      'Astroid Lounge is a community amenity supported in the background by ' +
      'the Astroid project. The Lounge is not a charity, is not affiliated ' +
      'with any hospital, and never solicits donations.',
  },

  emails: {
    support: 'support@astroid.space',
    security: 'security@astroid.space',
    abuse: 'security@astroid.space',
  },

  token: {
    mint: requiredOrEmpty(
      'NEXT_PUBLIC_TOKEN_MINT',
      '8NwtzwGm4CV8Hm4fJXR69ac1MxDYuSaN3A9HVyikpump',
    ),
    symbol: 'ASTROID',
    decimals: 6,
    minBalanceForEntry: Number(
      requiredOrEmpty('NEXT_PUBLIC_TOKEN_GATE_MIN_BALANCE', '10000'),
    ),
  },

  solana: {
    network: requiredOrEmpty('NEXT_PUBLIC_SOLANA_NETWORK', 'mainnet-beta'),
    rpcUrl: requiredOrEmpty(
      'NEXT_PUBLIC_SOLANA_RPC_URL',
      'https://api.mainnet-beta.solana.com',
    ),
  },

  treasury: {
    walletAddress: requiredOrEmpty('NEXT_PUBLIC_TREASURY_WALLET', ''),
    prizePoolMint: requiredOrEmpty(
      'PRIZE_POOL_USDC_MINT',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ),
  },

  /**
   * Money model is hard-coded freeroll. Do not add a `realMoney: true`
   * branch here. If the Lounge ever moves to a different model, that
   * is a legal-entity-level decision, not a config flag.
   */
  money: {
    model: 'freeroll' as const,
    acceptsFiat: false,
    acceptsCryptoBuyIns: false,
    rakePercent: 0,
  },
} as const;

export type AppConfig = typeof config;
