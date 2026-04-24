/**
 * Production-safe Logger Utility
 * 
 * Provides conditional logging that only outputs in development mode.
 * In production, logs are suppressed to avoid leaking sensitive information
 * and to improve performance.
 * 
 * Usage:
 * ```typescript
 * import { logger } from '../utils/logger.js';
 * 
 * logger.info('User joined game', { gameId, walletAddress });
 * logger.error('Database error', error);
 * logger.warn('Unusual blind ratio');
 * logger.debug('Detailed state', gameState);
 * ```
 */

const isDev = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
    [key: string]: unknown;
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(level: LogLevel, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

/**
 * Production-safe logger
 */
export const logger = {
    /**
     * Debug level - only logs in development
     * Use for detailed debugging information
     */
    debug(message: string, data?: LogData): void {
        if (isDev) {
            console.log(formatMessage('debug', message, data));
        }
    },

    /**
     * Info level - only logs in development
     * Use for general operational information
     */
    info(message: string, data?: LogData): void {
        if (isDev) {
            console.log(formatMessage('info', message, data));
        }
    },

    /**
     * Warning level - only logs in development
     * Use for potentially problematic situations
     */
    warn(message: string, data?: LogData): void {
        if (isDev) {
            console.warn(formatMessage('warn', message, data));
        }
    },

    /**
     * Error level - ALWAYS logs (even in production)
     * Use for errors that need to be tracked
     * Note: Be careful not to log sensitive data in error messages
     */
    error(message: string, error?: Error | unknown, data?: LogData): void {
        const errorData = error instanceof Error
            ? {
                errorMessage: error.message,
                errorName: error.name,
                // Only include stack in development
                ...(isDev && { stack: error.stack })
            }
            : { error: String(error) };

        console.error(formatMessage('error', message, { ...errorData, ...data }));
    },

    /**
     * Poker-specific logging with emoji prefixes
     * Only logs in development
     */
    poker: {
        action(action: string, data?: LogData): void {
            if (isDev) {
                console.log(`🎮 ${action}`, data ? JSON.stringify(data) : '');
            }
        },
        win(message: string, data?: LogData): void {
            if (isDev) {
                console.log(`🏆 ${message}`, data ? JSON.stringify(data) : '');
            }
        },
        start(message: string, data?: LogData): void {
            if (isDev) {
                console.log(`🎰 ${message}`, data ? JSON.stringify(data) : '');
            }
        },
        warning(message: string, data?: LogData): void {
            if (isDev) {
                console.warn(`⚠️ ${message}`, data ? JSON.stringify(data) : '');
            }
        },
        success(message: string, data?: LogData): void {
            if (isDev) {
                console.log(`✅ ${message}`, data ? JSON.stringify(data) : '');
            }
        },
        error(message: string, data?: LogData): void {
            if (isDev) {
                console.error(`❌ ${message}`, data ? JSON.stringify(data) : '');
            }
        },
    },

    /**
     * Database operation logging
     * Only logs in development
     */
    db: {
        query(operation: string, data?: LogData): void {
            if (isDev) {
                console.log(`📊 DB ${operation}`, data ? JSON.stringify(data) : '');
            }
        },
        error(operation: string, error: unknown): void {
            if (isDev) {
                console.error(`❌ DB ${operation} failed:`, error);
            }
        },
    },

    /**
     * Wallet/crypto operation logging
     * Only logs in development
     */
    wallet: {
        balance(message: string, data?: LogData): void {
            if (isDev) {
                console.log(`💰 ${message}`, data ? JSON.stringify(data) : '');
            }
        },
        transaction(message: string, data?: LogData): void {
            if (isDev) {
                console.log(`💸 ${message}`, data ? JSON.stringify(data) : '');
            }
        },
    },

    /**
     * Health monitoring logging
     * ALWAYS logs in production - these are critical monitoring events
     */
    health: {
        /**
         * Log a health check result
         */
        check(message: string, data?: LogData): void {
            console.log(`[HEALTH] ${message}`, data ? JSON.stringify(data) : '');
        },
        
        /**
         * Log a critical health alert (always logs)
         */
        critical(message: string, data?: LogData): void {
            console.error(`[HEALTH-CRITICAL] 🚨 ${message}`, data ? JSON.stringify(data) : '');
        },
        
        /**
         * Log a health warning (always logs)
         */
        warning(message: string, data?: LogData): void {
            console.warn(`[HEALTH-WARNING] ⚠️ ${message}`, data ? JSON.stringify(data) : '');
        },
        
        /**
         * Log an auto-fix attempt (always logs)
         */
        fix(message: string, data?: LogData): void {
            console.log(`[HEALTH-FIX] 🔧 ${message}`, data ? JSON.stringify(data) : '');
        },
        
        /**
         * Log fix success (always logs)
         */
        fixSuccess(message: string, data?: LogData): void {
            console.log(`[HEALTH-FIX] ✅ ${message}`, data ? JSON.stringify(data) : '');
        },
        
        /**
         * Log fix failure (always logs)
         */
        fixFailed(message: string, data?: LogData): void {
            console.error(`[HEALTH-FIX] ❌ ${message}`, data ? JSON.stringify(data) : '');
        },
    },
};

/**
 * Type guard to check if we should log
 */
export function shouldLog(): boolean {
    return isDev;
}

/**
 * Safely stringify data for logging (handles circular references)
 */
export function safeStringify(data: unknown): string {
    const seen = new WeakSet();
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    });
}

