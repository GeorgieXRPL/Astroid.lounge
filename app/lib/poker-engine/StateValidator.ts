// @ts-nocheck
/**
 * Poker State Validator
 * 
 * Provides validation logic for detecting stuck games, invalid states,
 * and invariant violations in the poker game engine.
 * 
 * Used by:
 * - /api/cron/poker-health.ts (periodic health checks)
 * - /api/admin/poker-diagnostic.ts (manual debugging)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface HealthAlert {
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  game_id?: string;
  hand_id?: string;
  player_id?: string;
  message: string;
  details: Record<string, any>;
  auto_fixable: boolean;
  fixed?: boolean;
  fix_action?: string;
}

export interface GameState {
  id: string;
  status: string;
  current_hand_id: string | null;
  pot: number;
  small_blind: number;
  big_blind: number;
  host_wallet: string;
  is_permanent_table: boolean;
  asset_type: string;
  created_at: string;
  updated_at: string;
}

export interface HandState {
  id: string;
  game_id: string;
  hand_number: number;
  status: string;
  main_pot: number;
  community_cards: string[];
  all_community_cards: string[];
  player_hands: Record<string, string[]>;
  actions: any[];
  winners: any[] | null;
  created_at: string;
  showdown_started_at: string | null;
}

export interface PlayerState {
  id: string;
  game_id: string;
  wallet_address: string;
  position: number;
  stack: number;
  status: string;
  needs_to_act: boolean;
  current_round_bet: number;
  total_hand_bet: number;
  buy_in_amount: number;
  last_action: string | null;
  last_action_at: string | null;
  turn_started_at: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  alerts: HealthAlert[];
  summary: {
    gamesChecked: number;
    handsChecked: number;
    playersChecked: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
  };
}

// ============================================
// CONFIGURATION
// ============================================

const STALE_GAME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STALE_TURN_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes (turn timer is usually 30s)
const SHOWDOWN_STUCK_THRESHOLD_MS = 60 * 1000; // 1 minute in showdown

// Valid hand status transitions
const VALID_HAND_STATUSES = ['preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];
const TERMINAL_STATUSES = ['showdown', 'complete'];

// ============================================
// VALIDATOR CLASS
// ============================================

export class StateValidator {
  private db: SupabaseClient;
  private alerts: HealthAlert[] = [];

  constructor(supabase: SupabaseClient) {
    this.db = supabase;
  }

  /**
   * Run all validation checks on active games
   */
  async validateAllActiveGames(): Promise<ValidationResult> {
    this.alerts = [];
    
    const stats = {
      gamesChecked: 0,
      handsChecked: 0,
      playersChecked: 0,
    };

    try {
      // Fetch all active games
      const { data: games, error: gamesError } = await this.db
        .from('poker_games')
        .select('*')
        .in('status', ['active', 'waiting']);

      if (gamesError) {
        this.addAlert({
          alert_type: 'database_error',
          severity: 'critical',
          message: 'Failed to fetch games for validation',
          details: { error: gamesError.message },
          auto_fixable: false,
        });
        return this.buildResult(stats);
      }

      stats.gamesChecked = games?.length || 0;

      for (const game of games || []) {
        await this.validateGame(game);
      }

      // Check for orphaned players
      await this.checkOrphanedPlayers();

      // Check for chip leaks across all active games
      await this.checkGlobalChipConservation();

    } catch (error: any) {
      this.addAlert({
        alert_type: 'validation_error',
        severity: 'critical',
        message: 'Validation process failed',
        details: { error: error.message },
        auto_fixable: false,
      });
    }

    return this.buildResult(stats);
  }

  /**
   * Validate a specific game by ID
   */
  async validateGameById(gameId: string): Promise<ValidationResult> {
    this.alerts = [];
    
    const stats = {
      gamesChecked: 1,
      handsChecked: 0,
      playersChecked: 0,
    };

    const { data: game, error } = await this.db
      .from('poker_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      this.addAlert({
        alert_type: 'game_not_found',
        severity: 'warning',
        game_id: gameId,
        message: `Game ${gameId} not found`,
        details: { error: error?.message },
        auto_fixable: false,
      });
      return this.buildResult(stats);
    }

    await this.validateGame(game);
    return this.buildResult(stats);
  }

  /**
   * Validate a single game and its related entities
   */
  private async validateGame(game: GameState): Promise<void> {
    // 1. Check game status consistency
    this.checkGameStatusConsistency(game);

    // 2. Fetch and validate players
    const { data: players } = await this.db
      .from('poker_players')
      .select('*')
      .eq('game_id', game.id)
      .order('position');

    if (!players || players.length === 0) {
      if (game.status === 'active') {
        this.addAlert({
          alert_type: 'no_players_in_active_game',
          severity: 'critical',
          game_id: game.id,
          message: 'Active game has no players',
          details: { game_status: game.status },
          auto_fixable: true,
          fix_action: 'set_game_waiting',
        });
      }
      return;
    }

    // 3. Validate player states
    for (const player of players) {
      this.validatePlayer(player, game);
    }

    // 4. Validate current hand if exists
    if (game.current_hand_id) {
      const { data: hand } = await this.db
        .from('poker_hands')
        .select('*')
        .eq('id', game.current_hand_id)
        .single();

      if (hand) {
        await this.validateHand(hand, game, players);
      } else {
        this.addAlert({
          alert_type: 'missing_hand',
          severity: 'critical',
          game_id: game.id,
          hand_id: game.current_hand_id,
          message: 'Game references non-existent hand',
          details: { current_hand_id: game.current_hand_id },
          auto_fixable: true,
          fix_action: 'clear_hand_reference',
        });
      }
    }

    // 5. Check for stuck active game
    if (game.status === 'active' && game.current_hand_id) {
      await this.checkStaleGame(game, players);
    }

    // 6. Validate chip conservation for this game
    this.validateChipConservation(game, players);
  }

  /**
   * Check if game status is consistent with its state
   */
  private checkGameStatusConsistency(game: GameState): void {
    // Active game should have a current hand
    if (game.status === 'active' && !game.current_hand_id) {
      this.addAlert({
        alert_type: 'active_game_no_hand',
        severity: 'warning',
        game_id: game.id,
        message: 'Active game has no current hand',
        details: { game_status: game.status },
        auto_fixable: true,
        fix_action: 'set_game_waiting',
      });
    }
  }

  /**
   * Validate a player's state
   */
  private validatePlayer(player: PlayerState, game: GameState): void {
    // Check for negative stack
    if (Number(player.stack) < 0) {
      this.addAlert({
        alert_type: 'negative_stack',
        severity: 'critical',
        game_id: game.id,
        player_id: player.id,
        message: `Player has negative stack: ${player.stack}`,
        details: { 
          wallet: player.wallet_address?.slice(0, 8),
          stack: player.stack,
          buy_in: player.buy_in_amount 
        },
        auto_fixable: false, // Requires investigation
      });
    }

    // Check for stuck turn
    if (player.needs_to_act && player.turn_started_at) {
      const turnStart = new Date(player.turn_started_at).getTime();
      const elapsed = Date.now() - turnStart;
      
      if (elapsed > STALE_TURN_THRESHOLD_MS) {
        this.addAlert({
          alert_type: 'stuck_turn',
          severity: 'warning',
          game_id: game.id,
          player_id: player.id,
          message: `Player turn stuck for ${Math.floor(elapsed / 1000)}s`,
          details: {
            wallet: player.wallet_address?.slice(0, 8),
            turn_started_at: player.turn_started_at,
            elapsed_seconds: Math.floor(elapsed / 1000),
          },
          auto_fixable: true,
          fix_action: 'force_fold',
        });
      }
    }

    // Check for invalid status
    const validStatuses = ['active', 'folded', 'all_in', 'eliminated', 'sitting_out'];
    if (!validStatuses.includes(player.status)) {
      this.addAlert({
        alert_type: 'invalid_player_status',
        severity: 'warning',
        game_id: game.id,
        player_id: player.id,
        message: `Invalid player status: ${player.status}`,
        details: { status: player.status },
        auto_fixable: false,
      });
    }
  }

  /**
   * Validate a hand's state
   */
  private async validateHand(hand: HandState, game: GameState, players: PlayerState[]): Promise<void> {
    // Check for invalid hand status
    if (!VALID_HAND_STATUSES.includes(hand.status)) {
      this.addAlert({
        alert_type: 'invalid_hand_status',
        severity: 'critical',
        game_id: game.id,
        hand_id: hand.id,
        message: `Invalid hand status: ${hand.status}`,
        details: { status: hand.status },
        auto_fixable: false,
      });
    }

    // Check for stuck showdown
    if (hand.status === 'showdown' && hand.showdown_started_at) {
      const showdownStart = new Date(hand.showdown_started_at).getTime();
      const elapsed = Date.now() - showdownStart;
      
      if (elapsed > SHOWDOWN_STUCK_THRESHOLD_MS) {
        this.addAlert({
          alert_type: 'stuck_showdown',
          severity: 'warning',
          game_id: game.id,
          hand_id: hand.id,
          message: `Showdown stuck for ${Math.floor(elapsed / 1000)}s`,
          details: {
            showdown_started_at: hand.showdown_started_at,
            elapsed_seconds: Math.floor(elapsed / 1000),
          },
          auto_fixable: true,
          fix_action: 'force_next_hand',
        });
      }
    }

    // Check if no one can act in non-terminal hand
    if (!TERMINAL_STATUSES.includes(hand.status)) {
      const playersWhoCanAct = players.filter(p => 
        p.status === 'active' && Number(p.stack) > 0.0001
      );
      const playerWithTurn = players.find(p => p.needs_to_act);

      if (playersWhoCanAct.length > 1 && !playerWithTurn) {
        this.addAlert({
          alert_type: 'no_player_turn',
          severity: 'critical',
          game_id: game.id,
          hand_id: hand.id,
          message: 'No player has needs_to_act=true in non-terminal hand',
          details: {
            hand_status: hand.status,
            players_who_can_act: playersWhoCanAct.length,
            all_player_statuses: players.map(p => ({
              id: p.id.slice(0, 8),
              status: p.status,
              needs_to_act: p.needs_to_act,
              stack: Number(p.stack),
            })),
          },
          auto_fixable: true,
          fix_action: 'set_next_player_turn',
        });
      }

      // Check if everyone folded but pot not awarded
      const activePlayers = players.filter(p => 
        p.status !== 'folded' && p.status !== 'eliminated'
      );

      if (activePlayers.length === 1 && hand.main_pot > 0 && !hand.winners) {
        this.addAlert({
          alert_type: 'unawareded_pot',
          severity: 'critical',
          game_id: game.id,
          hand_id: hand.id,
          message: 'Only one player remains but pot not awarded',
          details: {
            remaining_player: activePlayers[0]?.wallet_address?.slice(0, 8),
            pot: hand.main_pot,
          },
          auto_fixable: true,
          fix_action: 'award_pot_to_winner',
        });
      }

      if (activePlayers.length === 0) {
        this.addAlert({
          alert_type: 'no_active_players',
          severity: 'critical',
          game_id: game.id,
          hand_id: hand.id,
          message: 'Hand has no active players',
          details: {
            pot: hand.main_pot,
            player_statuses: players.map(p => p.status),
          },
          auto_fixable: true,
          fix_action: 'force_showdown',
        });
      }
    }

    // Check pot matches sum of bets
    const totalBets = players.reduce((sum, p) => sum + (Number(p.total_hand_bet) || 0), 0);
    const potDiff = Math.abs(totalBets - Number(hand.main_pot));
    
    if (potDiff > 0.01) { // Allow small floating point differences
      this.addAlert({
        alert_type: 'pot_mismatch',
        severity: 'warning',
        game_id: game.id,
        hand_id: hand.id,
        message: `Pot mismatch: sum of bets (${totalBets}) != main_pot (${hand.main_pot})`,
        details: {
          total_bets: totalBets,
          main_pot: hand.main_pot,
          difference: potDiff,
          player_bets: players.map(p => ({
            id: p.id.slice(0, 8),
            total_hand_bet: p.total_hand_bet,
          })),
        },
        auto_fixable: false, // Requires investigation
      });
    }
  }

  /**
   * Check if game is stale (no activity)
   */
  private async checkStaleGame(game: GameState, players: PlayerState[]): Promise<void> {
    // Get the most recent action timestamp
    const { data: hand } = await this.db
      .from('poker_hands')
      .select('actions, created_at')
      .eq('id', game.current_hand_id)
      .single();

    if (!hand) return;

    let lastActivityTime = new Date(hand.created_at).getTime();
    
    // Check player actions
    for (const player of players) {
      if (player.last_action_at) {
        const actionTime = new Date(player.last_action_at).getTime();
        if (actionTime > lastActivityTime) {
          lastActivityTime = actionTime;
        }
      }
    }

    const elapsed = Date.now() - lastActivityTime;
    
    if (elapsed > STALE_GAME_THRESHOLD_MS) {
      this.addAlert({
        alert_type: 'stale_game',
        severity: 'warning',
        game_id: game.id,
        hand_id: game.current_hand_id,
        message: `Game has been inactive for ${Math.floor(elapsed / 60000)} minutes`,
        details: {
          last_activity: new Date(lastActivityTime).toISOString(),
          elapsed_minutes: Math.floor(elapsed / 60000),
          player_count: players.filter(p => p.status === 'active').length,
        },
        auto_fixable: true,
        fix_action: 'check_and_advance_or_abort',
      });
    }
  }

  /**
   * Check for orphaned players (players without valid games)
   */
  private async checkOrphanedPlayers(): Promise<void> {
    const { data: orphanedPlayers } = await this.db
      .from('poker_players')
      .select('id, game_id, wallet_address, status')
      .not('game_id', 'in', this.db.from('poker_games').select('id'));

    // Simpler approach: check for players in games that don't exist
    const { data: allPlayers } = await this.db
      .from('poker_players')
      .select('id, game_id, wallet_address, status');

    const { data: allGames } = await this.db
      .from('poker_games')
      .select('id');

    if (!allPlayers || !allGames) return;

    const gameIds = new Set(allGames.map(g => g.id));
    const orphaned = allPlayers.filter(p => !gameIds.has(p.game_id));

    for (const player of orphaned) {
      this.addAlert({
        alert_type: 'orphaned_player',
        severity: 'warning',
        player_id: player.id,
        game_id: player.game_id,
        message: 'Player references non-existent game',
        details: {
          wallet: player.wallet_address?.slice(0, 8),
          status: player.status,
        },
        auto_fixable: true,
        fix_action: 'delete_orphaned_player',
      });
    }
  }

  /**
   * Validate chip conservation for a game
   */
  private validateChipConservation(game: GameState, players: PlayerState[]): void {
    // Only check for non-reward chip games (real money)
    // For reward chips, chip conservation is less critical due to grants
    
    const totalStacks = players.reduce((sum, p) => sum + (Number(p.stack) || 0), 0);
    const totalBuyIns = players.reduce((sum, p) => sum + (Number(p.buy_in_amount) || 0), 0);
    const currentPot = Number(game.pot) || 0;

    // Note: This doesn't account for rake or winnings credited
    // It's a rough check for obvious chip leaks
    const chipsInPlay = totalStacks + currentPot;
    const expectedMin = totalBuyIns * 0.9; // Allow 10% for rake
    
    if (chipsInPlay < expectedMin) {
      this.addAlert({
        alert_type: 'chip_leak',
        severity: 'warning',
        game_id: game.id,
        message: 'Possible chip leak detected',
        details: {
          total_stacks: totalStacks,
          current_pot: currentPot,
          chips_in_play: chipsInPlay,
          total_buy_ins: totalBuyIns,
          expected_minimum: expectedMin,
          deficit: expectedMin - chipsInPlay,
        },
        auto_fixable: false, // Requires investigation
      });
    }
  }

  /**
   * Global chip conservation check
   */
  private async checkGlobalChipConservation(): Promise<void> {
    // This is a more comprehensive check across all games
    // Implementation depends on how detailed tracking you need
    // For now, we rely on per-game checks
  }

  /**
   * Add an alert to the collection
   */
  private addAlert(alert: HealthAlert): void {
    this.alerts.push(alert);
  }

  /**
   * Build the validation result
   */
  private buildResult(stats: { gamesChecked: number; handsChecked: number; playersChecked: number }): ValidationResult {
    return {
      isValid: this.alerts.filter(a => a.severity === 'critical').length === 0,
      alerts: this.alerts,
      summary: {
        ...stats,
        criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
        warningAlerts: this.alerts.filter(a => a.severity === 'warning').length,
        infoAlerts: this.alerts.filter(a => a.severity === 'info').length,
      },
    };
  }

  /**
   * Get diagnostic information for a specific game
   */
  async getDiagnostics(gameId: string): Promise<{
    game: GameState | null;
    hand: HandState | null;
    players: PlayerState[];
    recentActions: any[];
    validation: ValidationResult;
    stateTimeline: any[];
  }> {
    // Fetch game
    const { data: game } = await this.db
      .from('poker_games')
      .select('*')
      .eq('id', gameId)
      .single();

    // Fetch players
    const { data: players } = await this.db
      .from('poker_players')
      .select('*')
      .eq('game_id', gameId)
      .order('position');

    // Fetch current hand
    let hand = null;
    if (game?.current_hand_id) {
      const { data: handData } = await this.db
        .from('poker_hands')
        .select('*')
        .eq('id', game.current_hand_id)
        .single();
      hand = handData;
    }

    // Fetch recent hands for timeline
    const { data: recentHands } = await this.db
      .from('poker_hands')
      .select('id, hand_number, status, main_pot, winners, created_at, showdown_started_at')
      .eq('game_id', gameId)
      .order('hand_number', { ascending: false })
      .limit(10);

    // Run validation
    const validation = await this.validateGameById(gameId);

    // Build state timeline
    const stateTimeline = (recentHands || []).map(h => ({
      hand_number: h.hand_number,
      status: h.status,
      pot: h.main_pot,
      winners: h.winners?.map((w: any) => w.wallet_address?.slice(0, 8)),
      created_at: h.created_at,
      showdown_at: h.showdown_started_at,
    }));

    return {
      game,
      hand,
      players: players || [],
      recentActions: hand?.actions || [],
      validation,
      stateTimeline,
    };
  }
}

