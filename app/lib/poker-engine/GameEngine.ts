// @ts-nocheck
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { determineWinnersFromPlayers } from './PokerLogic.js';
import { logger } from '../logger';
import { sanitizeWalletAddress } from '../validation';

// Singleton Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Poker Game Engine
 * 
 * Handles core game mechanics: betting, round advancement, showdowns, and hand management.
 */
export class GameEngine {

  /**
   * Advance the game to the next betting round or showdown.
   */
  static async advanceRound(gameId: string, handId: string, currentStatus: string) {
    const db = getSupabase();
    console.log(`🔄 ADVANCE_ROUND: gameId=${gameId?.slice(0, 8)}, handId=${handId?.slice(0, 8)}, currentStatus=${currentStatus}`);
    logger.poker.action(`🔄 advanceRound called - hand ${handId}, current status: ${currentStatus}`);

    try {
      const { data: hand, error: handError } = await db.from('poker_hands').select('*').eq('id', handId).single() as { data: any; error: any };
      if (!hand) {
        console.log(`❌ ADVANCE_ROUND_ERROR: Hand ${handId} not found! Error: ${handError?.message}`);
        logger.poker.error(`advanceRound: Hand ${handId} not found!`);
        return;
      }

    let newStatus = currentStatus;
    let newCards = [...(hand.community_cards || [])];

    if (currentStatus === 'preflop') {
      newCards = hand.all_community_cards.slice(0, 3);
      newStatus = 'flop';
        console.log(`📋 ADVANCE_TO_FLOP: ${newCards.join(', ')}`);
        logger.poker.action(`📋 Advancing to FLOP: ${newCards.join(', ')}`);
    } else if (currentStatus === 'flop') {
      newCards = hand.all_community_cards.slice(0, 4);
      newStatus = 'turn';
        console.log(`📋 ADVANCE_TO_TURN: ${newCards.join(', ')}`);
        logger.poker.action(`📋 Advancing to TURN: ${newCards.join(', ')}`);
    } else if (currentStatus === 'turn') {
      newCards = hand.all_community_cards;
      newStatus = 'river';
        console.log(`📋 ADVANCE_TO_RIVER: ${newCards.join(', ')}`);
        logger.poker.action(`📋 Advancing to RIVER: ${newCards.join(', ')}`);
    } else {
        // Status is 'river' - betting complete, go to showdown
        console.log(`🎴 RIVER_COMPLETE: Calling endShowdown for hand ${handId?.slice(0, 8)}`);
        logger.poker.action(`🎴 River betting complete - calling endShowdown`);
      await this.endShowdown(gameId, handId);
      return;
    }

    await (db.from('poker_hands').update({
      status: newStatus,
      community_cards: newCards,
      actions: []
    } as any) as any).eq('id', handId);

      // CRITICAL: Reset all player state for new round
      // - current_round_bet: 0 (new round starts with no bets)
      // - needs_to_act: false (will be set true for first player below)
      // - last_action: null (clear so round completion check knows no one has acted yet)
    await (db.from('poker_players')
        .update({
          current_round_bet: 0,
          needs_to_act: false,
          last_action: null  // Clear last action so round completion check works correctly
        } as any) as any)
      .eq('game_id', gameId)
      .eq('status', 'active');

    const { data: allPlayers } = await db.from('poker_players').select('*').eq('game_id', gameId).order('position') as { data: any[]; error: any };
    const { data: game } = await db.from('poker_games').select('dealer_position').eq('id', gameId).single() as { data: any; error: any };

      // Players who can take betting actions (active with chips)
    const playersCanAct = allPlayers?.filter((p: any) =>
        p.status === 'active' && Number(p.stack) > 0.0001
      ) || [];

      // Players still in the hand (not folded/eliminated/sitting_out)
      // IMPORTANT: Also check last_action - a player with status='all_in' but last_action='fold' has FOLDED!
      // NOTE: sitting_out players are NOT in the hand - they're skipped for deal and betting
      const playersInHand = allPlayers?.filter((p: any) =>
        !['folded', 'eliminated', 'sitting_out'].includes(p.status) && p.last_action !== 'fold'
      ) || [];

      // Count players who are all-in
      const allInPlayers = allPlayers?.filter((p: any) =>
        p.status === 'all_in' && p.last_action !== 'fold'
    ) || [];

      console.log(`👥 PLAYERS_CAN_ACT: ${playersCanAct.length}, PLAYERS_IN_HAND: ${playersInHand.length}, ALL_IN: ${allInPlayers.length}`);
      logger.poker.action(`👥 Players who can act: ${playersCanAct.length}, In hand: ${playersInHand.length}, All-in: ${allInPlayers.length}`);

      // Auto-showdown WHEN:
      // 1. NO players can act (all remaining are all-in) - they just watch cards
      // 2. Only 1 player remains in hand (everyone else folded)
      // 3. CRITICAL: If 1 player can act but ALL opponents are all-in AND action is complete
      //    This is post-flop when opponent went all-in earlier - no more betting possible.
      //    Example: Player A all-in preflop, Player B called. On flop, Player B shouldn't need to act.
      //    
      //    NOTE: advanceRound is only called AFTER round completion is confirmed.
      //    At start of new round, everyone's current_round_bet is reset to 0.
      //    So "all bets match" (all are 0) and we can safely check if all opponents are all-in.

      const allOpponentsAreAllIn = allInPlayers.length > 0 &&
        allInPlayers.length >= playersInHand.length - 1; // All but one (or zero) players are all-in

      // CRITICAL FIX: If only 1 player remains, award pot directly (fold win)
      // Don't go through showdown - just give them the pot
      if (playersInHand.length === 1) {
        const winner = playersInHand[0];
        console.log(`🏆 FOLD_WIN_IN_ADVANCE_ROUND: Only ${winner.wallet_address?.slice(0, 8)} remains - awarding pot`);
        logger.poker.action(`🏆 Fold win - ${winner.wallet_address?.slice(0, 8)} wins pot`);

        // Get fresh hand data for pot amount
        const { data: freshHand } = await db.from('poker_hands').select('main_pot').eq('id', handId).single() as { data: any; error: any };
        const potToAward = freshHand?.main_pot || 0;

        // Award pot to winner
        await (db.from('poker_players').update({
          stack: Number(winner.stack) + potToAward,
          total_winnings: (winner.total_winnings || 0) + potToAward,
          hands_won: (winner.hands_won || 0) + 1,
          cards_visible: false  // Don't reveal winner's cards on fold
        } as any) as any).eq('id', winner.id);

        // Mark hand as complete (not showdown - no card reveal)
        await (db.from('poker_hands').update({
          status: 'complete',
          showdown_started_at: new Date().toISOString(),
          winners: [{
            player_id: winner.id,
            wallet_address: winner.wallet_address,
            amount: potToAward,
            hand_name: 'Win by Fold',
            hand_description: 'All other players folded'
          }]
        } as any) as any).eq('id', handId);

        console.log(`💰 Awarded ${potToAward} to ${winner.wallet_address?.slice(0, 8)}`);
        return;
      }

      const shouldAutoShowdown =
        playersCanAct.length === 0 ||
        allOpponentsAreAllIn; // If all opponents are all-in, run out the board

      if (shouldAutoShowdown) {
        let reason = 'Unknown';
        if (playersCanAct.length === 0) reason = 'All players all-in';
        else if (allOpponentsAreAllIn) reason = 'All opponents all-in - running out board';

        console.log(`⚡ AUTO_SHOWDOWN_TRIGGER: ${reason} (canAct=${playersCanAct.length}, inHand=${playersInHand.length}, allIn=${allInPlayers.length})`);
        logger.poker.action(`⚡ ${reason} - advancing directly to showdown`);
      await this.advanceToShowdown(gameId, handId, newStatus);
      return;
    }

    if (allPlayers && game) {
      const dealerPos = game.dealer_position;
      for (let i = 0; i < allPlayers.length; i++) {
        const checkPos = (dealerPos + 1 + i) % allPlayers.length;
        const checkPlayer = allPlayers.find((p: any) => p.position === checkPos);
          if (checkPlayer && checkPlayer.status === 'active' && Number(checkPlayer.stack) > 0.0001) {
          await (db.from('poker_players').update({
            needs_to_act: true,
            turn_started_at: new Date().toISOString()
          } as any) as any).eq('id', checkPlayer.id);
            console.log(`👤 NEXT_PLAYER_SET: ${checkPlayer.wallet_address?.slice(0, 8)}`);
          return;
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ ADVANCE_ROUND_ERROR: ${error?.message || error}`, { stack: error?.stack?.slice(0, 500) });
      throw error; // Re-throw to propagate to action handler
    }
  }

  static async advanceToShowdown(gameId: string, handId: string, currentStatus: string) {
    const db = getSupabase();
    console.log(`⚡ ADVANCE_TO_SHOWDOWN: gameId=${gameId?.slice(0, 8)}, handId=${handId?.slice(0, 8)}, currentStatus=${currentStatus}`);
    logger.poker.action(`⚡ advanceToShowdown called - hand ${handId}, current status: ${currentStatus}`);

    try {
      const { data: hand, error: handError } = await db.from('poker_hands').select('*').eq('id', handId).single() as { data: any; error: any };

      if (!hand) {
        console.log(`❌ ADVANCE_TO_SHOWDOWN_ERROR: Hand ${handId} not found! Error: ${handError?.message}`);
        logger.poker.error(`advanceToShowdown: Hand ${handId} not found!`);
        return;
      }

      console.log(`📋 REVEAL_ALL_CARDS: ${hand.all_community_cards?.join(', ')}`);
      logger.poker.action(`📋 Revealing all community cards: ${hand.all_community_cards?.join(', ')}`);

    await (db.from('poker_hands').update({
      community_cards: hand.all_community_cards,
      status: 'river'
    } as any) as any).eq('id', handId);

      console.log(`🔄 CALLING_END_SHOWDOWN: handId=${handId?.slice(0, 8)}`);
      logger.poker.action(`🔄 Calling endShowdown for hand ${handId}`);
    await this.endShowdown(gameId, handId);
    } catch (error: any) {
      console.error(`❌ ADVANCE_TO_SHOWDOWN_ERROR: ${error?.message || error}`, { stack: error?.stack?.slice(0, 500) });
      throw error;
    }
  }

  static async endShowdown(gameId: string, handId: string) {
    const db = getSupabase();
    console.log(`🎴 END_SHOWDOWN: gameId=${gameId}, handId=${handId}`);
    logger.poker.action(`🎴 endShowdown called for hand ${handId}`);

    const { data: hand, error: handError } = await db.from('poker_hands').select('*').eq('id', handId).single() as { data: any; error: any };
    const { data: freshPlayers, error: playersError } = await db.from('poker_players').select('*').eq('game_id', gameId).order('position') as { data: any[]; error: any };
    const { data: game, error: gameError } = await db.from('poker_games').select('asset_type').eq('id', gameId).single() as { data: any; error: any };

    if (!hand || !freshPlayers || !game) {
      console.log(`❌ END_SHOWDOWN_FAILED: Missing data - hand=${!!hand}, players=${!!freshPlayers}, game=${!!game}`);
      logger.poker.error(`endShowdown failed to fetch data`, {
        hasHand: !!hand,
        handError: handError?.message,
        hasPlayers: !!freshPlayers,
        playersError: playersError?.message,
        hasGame: !!game,
        gameError: gameError?.message
      });
      return;
    }

    // Log hand data for debugging
    console.log(`📊 END_SHOWDOWN_DATA: handStatus=${hand.status}, playerCount=${freshPlayers.length}, communityCards=${hand.community_cards?.length || 0}, allCommunityCards=${hand.all_community_cards?.length || 0}, playerHands=${Object.keys(hand.player_hands || {}).length}`);
    logger.poker.action(`📊 Hand status: ${hand.status}, Players: ${freshPlayers.length}, Community cards: ${hand.community_cards?.length || 0}`);

    // IDEMPOTENCY CHECK: If hand is already in showdown or complete, don't award pot again!
    if (hand.status === 'showdown' || hand.status === 'complete') {
      logger.poker.warning(`⚠️ Hand ${handId} already in ${hand.status} - skipping duplicate pot award`);
      // NOTE: This is expected on subsequent calls - the first call should have awarded the pot
      return;
    }

    logger.poker.action(`✅ Proceeding with pot award (hand status: ${hand.status})`);

    // Filter for players still in the hand
    // IMPORTANT: Check both status AND last_action - a player with status='all_in' but last_action='fold' has FOLDED!
    const activePlayers = freshPlayers.filter((p: any) =>
      p.status !== 'folded' && p.status !== 'eliminated' && p.last_action !== 'fold'
    );

    if (activePlayers.length === 0) return;

    // RAKE CALCULATION
    // "No Flop, No Drop" rule: Only rake if flop was dealt (3+ community cards)
    const RAKE_PERCENTAGE = 0.05; // 5% flat rake
    const communityCardsDealt = hand.community_cards?.length || hand.all_community_cards?.length || 0;
    const reachedFlop = communityCardsDealt >= 3;
    const shouldTakeRake = game.asset_type !== 'reward_chips' && reachedFlop;

    let rakeAmount = 0;
    let potAfterRake = hand.main_pot;

    if (shouldTakeRake) {
      rakeAmount = hand.main_pot * RAKE_PERCENTAGE;
      potAfterRake = hand.main_pot - rakeAmount;
      logger.poker.action(`💰 Rake collected: ${rakeAmount.toFixed(4)} ${game.asset_type} (5% of ${hand.main_pot})`);
      console.log(`💰 RAKE_COLLECTED: ${rakeAmount.toFixed(8)} ${game.asset_type} from hand ${handId}`);

      // Credit rake to HOUSE account
      try {
        await db.rpc('credit_asset_balance', {
          p_user_id: 'HOUSE_RAKE',
          p_asset_type: game.asset_type,
          p_amount: rakeAmount
        });

        // Log rake transaction for audit
        await db.from('poker_transactions').insert({
          user_id: 'HOUSE_RAKE',
          type: 'rake',
          amount: rakeAmount,
          asset_type: game.asset_type,
          game_id: gameId,
          status: 'confirmed',
          metadata: { hand_id: handId, pot_size: hand.main_pot }
        });

        console.log(`✅ RAKE_CREDITED: ${rakeAmount.toFixed(8)} ${game.asset_type} to HOUSE_RAKE`);
      } catch (rakeError: any) {
        console.error(`❌ RAKE_CREDIT_FAILED: ${rakeError?.message}`);
        // Don't fail the showdown if rake credit fails - just log it
      }
    }

    logger.poker.action(`👥 Active players for showdown: ${activePlayers.length} (${activePlayers.map((p: any) => p.wallet_address?.slice(0, 8)).join(', ')})`);

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      const winAmount = potAfterRake;
      const newStack = Number(winner.stack) + Number(winAmount);

      logger.poker.win(`🏆 Single winner ${winner.wallet_address?.slice(0, 8)}`, {
        pot: winAmount,
        currentStack: winner.stack,
        newStack,
        rake: rakeAmount
      });
      
      const { error: playerUpdateError } = await (db.from('poker_players').update({
        stack: newStack,
        total_winnings: (winner.total_winnings || 0) + winAmount,
        hands_won: (winner.hands_won || 0) + 1,
        cards_visible: true
      } as any) as any).eq('id', winner.id);

      if (playerUpdateError) {
        logger.poker.error(`❌ Failed to update winner stack`, { error: playerUpdateError, winnerId: winner.id });
      }

      // Ensure community_cards are saved (use all_community_cards as fallback)
      const fullCommunityCards = hand.all_community_cards || hand.community_cards || [];

      const { error: handUpdateError } = await (db.from('poker_hands').update({
        status: 'showdown',
        showdown_started_at: new Date().toISOString(),
        community_cards: fullCommunityCards,  // CRITICAL: Ensure community cards are saved
        winners: [{
          player_id: winner.id,
          wallet_address: winner.wallet_address,
          amount: winAmount,
          hand_name: 'Win by Fold'
        }],
        metadata: { rake_collected: rakeAmount, rake_percentage: shouldTakeRake ? RAKE_PERCENTAGE : 0 }
      } as any) as any).eq('id', handId);

      if (handUpdateError) {
        console.log(`❌ SHOWDOWN_ERROR: Single winner - ${JSON.stringify(handUpdateError)}`);
        logger.poker.error(`❌ Failed to set hand status to showdown`, { error: handUpdateError, handId });
      } else {
        console.log(`✅ SHOWDOWN_COMPLETE: Single winner handId=${handId}, winner=${winner.wallet_address?.slice(0, 8)}, communityCards=${fullCommunityCards.length}`);
        logger.poker.success(`✅ Single winner showdown complete - hand ${handId} awarded to ${winner.wallet_address?.slice(0, 8)}`);
      }
      return;
    }

    try {
      logger.poker.action(`🃏 Evaluating hands for ${activePlayers.length} players at showdown`);

      const communityCards = hand.community_cards && hand.community_cards.length === 5
        ? hand.community_cards
        : hand.all_community_cards;

      logger.poker.action(`📋 Community cards: ${communityCards?.join(', ') || 'NONE'}`);

      const playerHandsMap = hand.player_hands || {};

      const playersForEval = activePlayers.map((p: any) => {
        const holeCards = playerHandsMap[p.id] || [];
        if (!holeCards || holeCards.length === 0) {
          logger.poker.error(`🚨 Player ${p.wallet_address?.slice(0, 8)} has NO HOLE CARDS!`, {
            playerId: p.id,
            playerHandsMapKeys: Object.keys(playerHandsMap),
            playerHandsMap: JSON.stringify(playerHandsMap)
          });
        } else {
          logger.poker.action(`  Player ${p.wallet_address?.slice(0, 8)}: ${holeCards.join(', ')}`);
        }
        return {
        player_id: p.id,
        wallet_address: p.wallet_address,
          hole_cards: holeCards,
        status: p.status,
        stack: p.stack,
        total_hand_bet: p.total_hand_bet || 0
        };
      });

      const activeBets = activePlayers.map((p: any) => Number(p.total_hand_bet) || 0);
      const maxMatchedBet = Math.min(...activeBets);
      // Start with pot after rake deduction
      let potToDistribute = potAfterRake;

      logger.poker.action(`📊 Pot calculation: mainPot=${hand.main_pot}, rake=${rakeAmount}, potAfterRake=${potAfterRake}`);
      logger.poker.action(`📊 Active bets: ${activeBets.join(', ')}, maxMatchedBet=${maxMatchedBet}`);

      for (const player of activePlayers) {
        const uncalledBet = (Number(player.total_hand_bet) || 0) - maxMatchedBet;
        if (uncalledBet > 0) {
          const newStack = Number(player.stack) + uncalledBet;
          logger.poker.action(`💵 Returning ${uncalledBet} uncalled bet to ${player.wallet_address?.slice(0, 8)}: ${player.stack} + ${uncalledBet} = ${newStack}`);
          await (db.from('poker_players').update({
            stack: newStack,
          } as any) as any).eq('id', player.id);
          player.stack = newStack;
          potToDistribute -= uncalledBet;
        }
      }

      // SAFETY: Ensure pot is not negative
      if (potToDistribute < 0) {
        logger.poker.error(`🚨 CRITICAL: potToDistribute is negative! ${potToDistribute}`, { mainPot: hand.main_pot, rake: rakeAmount });
        potToDistribute = 0;
      }

      logger.wallet.balance(`Pot to distribute at showdown`, { potToDistribute, originalMainPot: hand.main_pot, rakeCollected: rakeAmount });
      const winners = determineWinnersFromPlayers(playersForEval, communityCards, potToDistribute);

      // Award pot to winners
      for (const winner of winners) {
        const player = freshPlayers.find((p: any) => p.id === winner.player_id);
        if (!player) {
          logger.poker.error(`⚠️ Winner player not found in freshPlayers!`, { winnerId: winner.player_id, winnerWallet: winner.wallet_address });
          continue;
        }

        const newStack = Number(player.stack) + Number(winner.win_amount);
        logger.poker.action(`💰 Awarding ${winner.win_amount} to ${player.wallet_address?.slice(0, 8)}: ${player.stack} + ${winner.win_amount} = ${newStack}`);

        const { error: updateError } = await (db.from('poker_players').update({
          stack: newStack,
            total_winnings: (player.total_winnings || 0) + winner.win_amount,
            hands_won: (player.hands_won || 0) + 1
          } as any) as any).eq('id', player.id);

        if (updateError) {
          logger.poker.error(`❌ Failed to award pot to winner`, { error: updateError, playerId: player.id });
        }
      }

      // Make cards visible for all active players
      for (const player of activePlayers) {
        await (db.from('poker_players').update({ cards_visible: true } as any) as any).eq('id', player.id);
      }

      // CRITICAL: Set hand status to 'showdown' - this triggers frontend to advance game
      // Also ensure community_cards are saved for hand history
      const { error: handUpdateError } = await (db.from('poker_hands').update({
        status: 'showdown',
        showdown_started_at: new Date().toISOString(),
        community_cards: communityCards,  // Ensure community cards are saved
        winners: winners.map(w => ({
          player_id: w.player_id,
          wallet_address: w.wallet_address,
          hand_name: w.hand_name,
          hand_description: w.hand_description,
          best_cards: w.best_cards,
          amount: w.win_amount
        })),
        metadata: { rake_collected: rakeAmount, rake_percentage: shouldTakeRake ? RAKE_PERCENTAGE : 0 }
      } as any) as any).eq('id', handId);

      if (handUpdateError) {
        console.log(`❌ SHOWDOWN_ERROR: Failed to update hand status - ${JSON.stringify(handUpdateError)}`);
        logger.poker.error(`❌ Failed to update hand status to showdown`, { error: handUpdateError, handId });
      } else {
        const winnerInfo = winners.map(w => `${w.wallet_address?.slice(0, 8)} (${w.hand_name}: ${w.win_amount})`).join(', ');
        console.log(`✅ SHOWDOWN_COMPLETE: handId=${handId}, communityCards=${communityCards?.length || 0}, winners=${winnerInfo}`);
        logger.poker.success(`✅ Showdown complete! Winners awarded, hand ${handId} status set to 'showdown'`);
        logger.poker.action(`🎉 Winners: ${winnerInfo}`);
      }

    } catch (error: any) {
      logger.poker.error('🚨 Error in showdown hand evaluation!', {
        error: error?.message || error,
        stack: error?.stack,
        handId,
        gameId,
        activePlayers: activePlayers.map((p: any) => ({
          id: p.id,
          wallet: p.wallet_address?.slice(0, 8),
          status: p.status
        }))
      });

      // Fallback - still apply rake and award to first active player
      // This prevents the game from getting stuck
      const fallbackWinAmount = potAfterRake;
      const fallbackWinner = activePlayers[0];

      logger.poker.warning(`⚠️ Fallback: Awarding pot (${fallbackWinAmount}) to first active player ${fallbackWinner?.wallet_address?.slice(0, 8)}`);

      await (db.from('poker_players').update({
        stack: fallbackWinner.stack + fallbackWinAmount,
        total_winnings: (fallbackWinner.total_winnings || 0) + fallbackWinAmount,
        hands_won: (fallbackWinner.hands_won || 0) + 1,
        cards_visible: true
      } as any) as any).eq('id', fallbackWinner.id);

      await (db.from('poker_hands').update({
        status: 'showdown',
        showdown_started_at: new Date().toISOString(),
        winners: [{
          player_id: fallbackWinner.id,
          wallet_address: fallbackWinner.wallet_address,
          amount: fallbackWinAmount,
          hand_name: 'Error Fallback - CHECK LOGS'
        }],
        metadata: {
          rake_collected: rakeAmount,
          rake_percentage: shouldTakeRake ? RAKE_PERCENTAGE : 0,
          error: error?.message || 'Unknown error'
        }
      } as any) as any).eq('id', handId);

      console.error(`❌ SHOWDOWN_FALLBACK_ERROR: ${error?.message || 'Unknown error'}`);

      logger.poker.warning(`✅ Fallback showdown completed - hand ${handId} status set to 'showdown'`);
    }
  }

  static async startNextHand(gameId: string) {
    const db = getSupabase();
    const { data: game } = await db.from('poker_games').select('*').eq('id', gameId).single() as { data: any; error: any };
    const { data: players } = await db.from('poker_players').select('*').eq('game_id', gameId).order('position') as { data: any[]; error: any };

    if (!game || !players) return;

    // Handle players who joined mid-game
    const midGameJoiners = players.filter((p: any) => p.will_join_next_hand === true);
    if (midGameJoiners.length > 0) {
      logger.poker.action(`Activating ${midGameJoiners.length} mid-game joiner(s)`);
      for (const joiner of midGameJoiners) {
        await (db.from('poker_players').update({
          status: 'active',
          will_join_next_hand: false,
          needs_to_act: false
        } as any) as any).eq('id', joiner.id);
      }
      const { data: refreshedPlayers } = await db.from('poker_players').select('*').eq('game_id', gameId).order('position') as { data: any[]; error: any };
      if (refreshedPlayers) {
        players.length = 0;
        players.push(...refreshedPlayers);
      }
    }

    // Filter out players who want to sit out (global sit-out feature)
    // Also filter out sitting_out status and players with no chips
    const playersWithChips = players.filter((p: any) => 
      Number(p.stack) > 0.0001 && 
      p.status !== 'sitting_out' && 
      !p.wants_to_sit_out
    );
    
    // Mark players who want to sit out as sitting_out status
    const wantToSitOut = players.filter((p: any) => 
      p.wants_to_sit_out && p.status !== 'sitting_out' && Number(p.stack) > 0.0001
    );
    if (wantToSitOut.length > 0) {
      logger.poker.action(`Marking ${wantToSitOut.length} player(s) as sitting_out (by choice)`);
      for (const player of wantToSitOut) {
        await (db.from('poker_players').update({
          status: 'sitting_out',
          needs_to_act: false
        } as any) as any).eq('id', player.id);
      }
    }
    
    const eliminatedPlayers = players.filter((p: any) => Number(p.stack) <= 0.0001 && !p.will_join_next_hand);

    if (eliminatedPlayers.length > 0) {
      logger.poker.action(`Marking ${eliminatedPlayers.length} player(s) as eliminated`);
      for (const player of eliminatedPlayers) {
        // FIX: Don't DELETE players - just mark as eliminated
        // This allows them to see rebuy prompt and prevents "Player not found" errors
        await (db.from('poker_players').update({
          status: 'eliminated',
          needs_to_act: false,
          cards_visible: false
        } as any) as any).eq('id', player.id);
      }
    }

    if (playersWithChips.length < 2) {
      if (game.is_permanent_table || !game.is_admin_game) {
        logger.poker.action('Cash game waiting for more players');

        if (playersWithChips.length === 1) {
          const remainingPlayer = playersWithChips[0];
          await (db.from('poker_players').update({
            status: 'active',
            needs_to_act: false,
            current_bet: 0,
            total_hand_bet: 0,
            cards_visible: false
          } as any) as any).eq('id', remainingPlayer.id);
        }

        await (db.from('poker_games').update({
          status: 'waiting',
          current_hand_id: null,
          pot: 0,
          current_players: playersWithChips.length
        } as any) as any).eq('id', gameId);
        return;
      }

      const finalWinner = playersWithChips[0];
      if (game.status === 'finished' || game.winner) return;

      logger.poker.win('Tournament Game over - final winner', { wallet: finalWinner?.wallet_address });

      const { error: updateError, count: updateCount } = await (db
        .from('poker_games')
        .update({
          status: 'finished',
          winner: finalWinner?.wallet_address,
          current_hand_id: null,
          pot: 0
        } as any) as any)
        .eq('id', gameId)
        .neq('status', 'finished') as { error: any; count: number };

      if (updateError || updateCount === 0) return;

      // NOTE: Chip crediting is now handled by /api/poker/games/next-hand.ts
      // Don't credit chips here to avoid double crediting!
      // The next-hand API is the single source of truth for chip crediting.
      logger.poker.action(`Tournament finished - chip crediting will be handled by next-hand API`);
      return;
    }

    // CRITICAL FIX: Rotate dealer by finding current dealer in sorted players array
    // and moving to the next player (clockwise). Store SEAT position, not array index.
    const sortedPlayers = [...playersWithChips].sort((a: any, b: any) => a.position - b.position);
    const currentDealerSeat = game.dealer_position;
    const currentDealerIndex = sortedPlayers.findIndex((p: any) => p.position === currentDealerSeat);
    const nextDealerIndex = (currentDealerIndex === -1 ? 0 : currentDealerIndex + 1) % sortedPlayers.length;
    const newDealerPlayer = sortedPlayers[nextDealerIndex];
    const newDealerPos = nextDealerIndex; // Array index for dealNewHand

    try {
      const newHandId = await this.dealNewHand(gameId, sortedPlayers, newDealerPos, game.small_blind, game.big_blind);

      if (!newHandId) {
        console.error('❌ dealNewHand returned null/undefined hand ID!');
        throw new Error('Failed to create new hand - no hand ID returned');
      }

      await (db.from('poker_games').update({
        current_hand_id: newHandId,
        dealer_position: newDealerPlayer.position,  // Store seat position
        pot: game.small_blind + game.big_blind,
        status: 'active'
      } as any) as any).eq('id', gameId);
      
      console.log(`✅ startNextHand complete: handId=${newHandId?.slice(0, 8)}, dealerSeat=${newDealerPlayer.position}`);
    } catch (error: any) {
      console.error('❌ Error in startNextHand/dealNewHand:', error?.message || error);
      logger.error('Error in dealNewHand', error);
      // CRITICAL FIX: Re-throw the error so callers know the hand creation failed!
      // Without this, join.ts thinks the game started successfully when it didn't
      throw error;
    }
  }

  private static async updateRewardBalance(winner: any) {
    const db = getSupabase();
    const netWinnings = winner.stack - winner.buy_in_amount;
    const { data: allBalances } = await db.from('user_reward_balances').select('*') as { data: any[]; error: any };

    const matches = allBalances?.filter((b: any) =>
      sanitizeWalletAddress(b.wallet_address) === sanitizeWalletAddress(winner.wallet_address)
    ) || [];

    const currentBalance = matches.length > 0 ? matches[0] : null;

    if (currentBalance) {
      const newBalance = (currentBalance.current_balance || 0) + winner.stack;
      const newTotalEarned = (currentBalance.total_earned || 0) + Math.max(netWinnings, 0);

      await (db.from('user_reward_balances').update({
        current_balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString()
      } as any) as any).eq('id', currentBalance.id);
    } else {
      await (db.from('user_reward_balances').insert({
        wallet_address: sanitizeWalletAddress(winner.wallet_address),
        current_balance: winner.stack,
        total_earned: Math.max(netWinnings, 0),
        games_played_with_rewards: 1
      } as any) as any);
    }
  }

  static async dealNewHand(gameId: string, players: any[], dealerPos: number, smallBlind: number, bigBlind: number): Promise<string> {
    const db = getSupabase();
    const deck = this.generateDeck();
    this.shuffleDeck(deck);

    const playerCards: { [playerId: string]: string[] } = {};
    for (const player of players) {
      playerCards[player.id] = [deck.pop()!, deck.pop()!];
    }

    const burn1 = [deck.pop()!];
    const flop = [deck.pop()!, deck.pop()!, deck.pop()!];
    const burn2 = [deck.pop()!];
    const turn = [deck.pop()!];
    const burn3 = [deck.pop()!];
    const river = [deck.pop()!];

    const allCommunityCards = [...flop, ...turn, ...river];
    const burnedCards = [...burn1, ...burn2, ...burn3];

    const numPlayers = players.length;
    const sbPos = numPlayers === 2 ? dealerPos : (dealerPos + 1) % numPlayers;
    const bbPos = numPlayers === 2 ? (dealerPos + 1) % numPlayers : (dealerPos + 2) % numPlayers;
    const utgPos = numPlayers === 2 ? dealerPos : (bbPos + 1) % numPlayers;

    const { data: lastHand } = await db
      .from('poker_hands')
      .select('hand_number')
      .eq('game_id', gameId)
      .order('hand_number', { ascending: false })
      .limit(1)
      .single() as { data: any; error: any };

    const handNumber = (lastHand?.hand_number || 0) + 1;

    const sbPlayer = players.find((p: any) => p.position === sbPos) || players[sbPos];
    const bbPlayer = players.find((p: any) => p.position === bbPos) || players[bbPos];

    if (!sbPlayer || !bbPlayer) {
      logger.poker.error('Could not find SB or BB player!', { sbPos, bbPos, players: players.map((p: any) => ({ id: p.id, position: p.position })) });
      throw new Error('Could not find blind players');
    }

    const sbAmount = Math.min(smallBlind, Number(sbPlayer.stack));
    const bbAmount = Math.min(bigBlind, Number(bbPlayer.stack));

    // CRITICAL FIX: Store actual SEAT positions, not array indices
    // Frontend compares p.position (seat) against these values
    const dealerPlayer = players.find((p: any) => p.position === dealerPos) || players[dealerPos];
    const { data: newHand, error: handError } = await (db.from('poker_hands').insert({
      game_id: gameId,
      hand_number: handNumber,
      status: 'preflop',
      dealer_position: dealerPlayer.position,  // Store seat position
      small_blind_position: sbPlayer.position,  // Store seat position
      big_blind_position: bbPlayer.position,  // Store seat position
      current_turn_position: utgPos,
      community_cards: [],
      all_community_cards: allCommunityCards,
      burned_cards: burnedCards,
      main_pot: sbAmount + bbAmount,
      player_hands: playerCards,
      actions: [
        { player_id: sbPlayer.id, action: 'small_blind', amount: sbAmount, timestamp: new Date().toISOString() },
        { player_id: bbPlayer.id, action: 'big_blind', amount: bbAmount, timestamp: new Date().toISOString() }
      ]
    } as any) as any).select().single() as { data: any; error: any };

    if (handError || !newHand) {
      throw new Error(`Failed to create new hand: ${handError?.message || 'Unknown error'}`);
    }

    for (const player of players) {
      const isSB = player.id === sbPlayer.id;
      const isBB = player.id === bbPlayer.id;

      let stackAfterBlind = Number(player.stack);
      let roundBet = 0;

      if (isSB && Number(player.stack) > 0.0001) {
        const amount = Math.min(smallBlind, Number(player.stack));
        stackAfterBlind -= amount;
        roundBet = amount;
      } else if (isBB && Number(player.stack) > 0.0001) {
        const amount = Math.min(bigBlind, Number(player.stack));
        stackAfterBlind -= amount;
        roundBet = amount;
      }

      await (db.from('poker_players').update({
        stack: stackAfterBlind,
        current_round_bet: roundBet,
        total_hand_bet: roundBet,
        status: stackAfterBlind < 0.0001 ? 'all_in' : 'active',
        needs_to_act: false,
        last_action_at: new Date().toISOString()
      } as any) as any).eq('id', player.id);
    }

    const firstToActPos = numPlayers === 2 ? dealerPos : utgPos;
    const firstToAct = players.find((p: any) => p.position === firstToActPos) || players[firstToActPos];

    logger.debug('First to act calculation', {
      numPlayers,
      dealerPos,
      sbPos,
      bbPos,
      utgPos,
      firstToActPos,
      firstToActId: firstToAct?.id,
      firstToActWallet: firstToAct?.wallet_address?.slice(0, 8),
      firstToActStack: firstToAct?.stack
    });

    if (firstToAct && Number(firstToAct.stack) > 0.0001) {
      await (db.from('poker_players').update({
        needs_to_act: true,
        turn_started_at: new Date().toISOString()
      } as any) as any).eq('id', firstToAct.id);
      logger.poker.success(`Set needs_to_act=true for player ${firstToAct.id}`);
    } else {
      logger.poker.error('Could not find first player to act!', { firstToActPos, players: players.map((p: any) => ({ id: p.id, position: p.position })) });
    }

    return newHand.id;
  }

  static async awardPotToWinner(winner: any, pot: number, handId: string) {
    const db = getSupabase();
    await (db.from('poker_players').update({
      stack: winner.stack + pot,
      total_winnings: (winner.total_winnings || 0) + pot,
      hands_won: (winner.hands_won || 0) + 1
    } as any) as any).eq('id', winner.id);

    await (db.from('poker_hands').update({
      status: 'complete',
      winners: [{ player_id: winner.id, amount: pot, hand: 'Win by fold' }]
    } as any) as any).eq('id', handId);
  }

  private static generateDeck(): string[] {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck: string[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    return deck;
  }

  private static shuffleDeck(deck: string[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
}
