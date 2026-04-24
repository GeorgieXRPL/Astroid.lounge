/**
 * Zod Validation Schemas for API Endpoints
 * 
 * Centralized input validation for all poker and API endpoints.
 * Provides type-safe validation with detailed error messages.
 */

import { z } from 'zod';

// ============================================
// COMMON VALIDATORS
// ============================================

/**
 * Wallet address validator
 * Supports both EVM (0x...) and Solana (base58) addresses
 */
export const walletAddressSchema = z.string()
    .min(32, 'Wallet address too short')
    .max(64, 'Wallet address too long')
    .refine((val) => {
        // EVM address (0x followed by 40 hex chars)
        const isEVM = /^0x[a-fA-F0-9]{40}$/.test(val);
        // Solana address (32-44 base58 chars)
        const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val);
        return isEVM || isSolana;
    }, 'Invalid wallet address format');

/**
 * UUID validator for game IDs, player IDs, etc.
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Positive number validator
 * Uses z.coerce to automatically convert strings to numbers (fixes slider input issues)
 */
export const positiveNumberSchema = z.coerce.number()
    .positive('Value must be positive')
    .finite('Value must be finite');

/**
 * Non-negative number validator (allows 0)
 * Uses z.coerce to automatically convert strings to numbers
 */
export const nonNegativeNumberSchema = z.coerce.number()
    .min(0, 'Value cannot be negative')
    .finite('Value must be finite');

// ============================================
// POKER GAME SCHEMAS
// ============================================

/**
 * Asset types supported by poker games
 */
export const assetTypeSchema = z.enum([
    'reward_chips',
    'SOL',
    'ETH',
    'USDC',
    'BTC'
], { errorMap: () => ({ message: 'Invalid asset type' }) });

/**
 * Game status enum
 */
export const gameStatusSchema = z.enum([
    'waiting',
    'active',
    'completed',
    'cancelled',
    'archived'
]);

/**
 * Player status enum
 */
export const playerStatusSchema = z.enum([
    'active',
    'folded',
    'all_in',
    'sitting_out',
    'eliminated'
]);

/**
 * Poker action types
 */
export const pokerActionSchema = z.enum([
    'fold',
    'check',
    'call',
    'raise',
    'all_in',
    'check_timeout',
    'process_hand_completion'
]);

/**
 * Create game request schema
 */
export const createGameSchema = z.object({
    name: z.string()
        .min(1, 'Game name is required')
        .max(100, 'Game name too long')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Game name contains invalid characters'),
    host_wallet: walletAddressSchema,
    asset_type: assetTypeSchema,
    small_blind: positiveNumberSchema.refine(
        (val) => val >= 0.01,
        'Small blind must be at least 0.01'
    ),
    big_blind: positiveNumberSchema,
    min_buy_in: positiveNumberSchema,
    max_buy_in: positiveNumberSchema,
    max_players: z.number()
        .int('Max players must be an integer')
        .min(2, 'Minimum 2 players required')
        .max(10, 'Maximum 10 players allowed')
        .optional()
        .default(9),
}).refine(
    (data) => data.big_blind > data.small_blind,
    { message: 'Big blind must be greater than small blind', path: ['big_blind'] }
).refine(
    (data) => data.max_buy_in > data.min_buy_in,
    { message: 'Max buy-in must be greater than min buy-in', path: ['max_buy_in'] }
).refine(
    (data) => data.min_buy_in >= data.big_blind * 10,
    { message: 'Min buy-in must be at least 10 big blinds', path: ['min_buy_in'] }
);

/**
 * Join game request schema
 */
export const joinGameSchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
    buy_in_amount: positiveNumberSchema,
});

/**
 * Game action request schema
 */
export const gameActionSchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
    action: pokerActionSchema,
    amount: nonNegativeNumberSchema.optional(),
}).refine(
    (data) => {
        // Amount is required for raise action
        if (data.action === 'raise' && (data.amount === undefined || data.amount <= 0)) {
            return false;
        }
        return true;
    },
    { message: 'Amount is required for raise action', path: ['amount'] }
);

/**
 * Leave game request schema
 */
export const leaveGameSchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
});

/**
 * Rebuy request schema
 */
export const rebuySchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
    amount: positiveNumberSchema,
});

/**
 * Start game request schema
 */
export const startGameSchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
});

/**
 * Heartbeat request schema
 */
export const heartbeatSchema = z.object({
    game_id: uuidSchema,
    wallet_address: walletAddressSchema,
});

// ============================================
// REWARD SCHEMAS
// ============================================

/**
 * Grant reward request schema
 */
export const grantRewardSchema = z.object({
    wallet_address: walletAddressSchema,
    amount: positiveNumberSchema,
    reason: z.string().min(1).max(255).optional(),
    source: z.enum(['dex_trade', 'poker_win', 'referral', 'bonus', 'admin']).optional(),
    dex_trade_hash: z.string().max(128).optional(),
});

/**
 * Withdraw request schema
 */
export const withdrawSchema = z.object({
    wallet_address: walletAddressSchema,
    amount: positiveNumberSchema,
    destination_address: walletAddressSchema.optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate request body against a schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodError(error: z.ZodError): {
    error: string;
    details: Array<{ field: string; message: string }>;
} {
    return {
        error: 'Validation error',
        details: error.errors.map((e) => ({
            field: e.path.join('.') || 'body',
            message: e.message,
        })),
    };
}

/**
 * Sanitize wallet address (lowercase for consistency)
 */
export function sanitizeWalletAddress(address: string): string {
    // EVM addresses should be lowercased for consistency
    if (address.startsWith('0x')) {
        return address.toLowerCase();
    }
    // Solana addresses are case-sensitive, don't modify
    return address;
}

/**
 * Sanitize string input (trim whitespace, remove dangerous chars)
 */
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential XSS chars
        .slice(0, 1000); // Limit length
}

