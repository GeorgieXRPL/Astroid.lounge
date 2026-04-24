/**
 * Hand Manager
 * 
 * Manages poker hand lifecycle: dealing cards, betting rounds, and showdown.
 * Adapted from XBTC-Vercel poker engine for Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { generateDeck, dealCards, findBestHand, evaluateHand } from './CardUtils';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Start a new hand in a poker game
 */
export async function startNewHand(gameId: string): Promise<void> {
  // Get game and players
  const { data: game, error: gameError } = await supabase
    .from('poker_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    throw new Error('Game not found');
  }

  const { data: players, error: playersError } = await supabase
    .from('poker_players')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'active')
    .order('position');

  if (playersError || !players || players.length < 2) {
    throw new Error('Not enough players to start hand');
  }

  // Generate and shuffle deck
  const deck = generateDeck();

  // Deal hole cards (2 per player)
  const playerHands: Record<string, string[]> = {};
  players.forEach((player) => {
    playerHands[player.id] = dealCards(deck, 2);
  });

  // Pre-deal all 5 community cards (but don't reveal yet)
  const burn1 = dealCards(deck, 1); // Burn before flop
  const flop = dealCards(deck, 3);
  const burn2 = dealCards(deck, 1); // Burn before turn
  const turn = dealCards(deck, 1);
  const burn3 = dealCards(deck, 1); // Burn before river
  const river = dealCards(deck, 1);

  const allCommunityCards = [...flop, ...turn, ...river];
  const burnedCards = [...burn1, ...burn2, ...burn3];

  // Determine positions
  const dealerPos = game.dealer_position;
  const smallBlindPos = (dealerPos + 1) % players.length;
  const bigBlindPos = (dealerPos + 2) % players.length;

  // Post blinds
  const smallBlindPlayer = players[smallBlindPos];
  const bigBlindPlayer = players[bigBlindPos];

  // Create hand record
  const { data: hand, error: handError } = await supabase
    .from('poker_hands')
    .insert({
      game_id: gameId,
      hand_number: (await getHandCount(gameId)) + 1,
      status: 'preflop',
      dealer_position: dealerPos,
      small_blind_position: smallBlindPos,
      big_blind_position: bigBlindPos,
      current_turn_position: (bigBlindPos + 1) % players.length, // UTG starts preflop
      community_cards: [],
      all_community_cards: allCommunityCards,
      burned_cards: burnedCards,
      main_pot: game.small_blind + game.big_blind,
      player_hands: playerHands,
      actions: [
        { player_id: smallBlindPlayer.id, action: 'small_blind', amount: game.small_blind, timestamp: new Date().toISOString() },
        { player_id: bigBlindPlayer.id, action: 'big_blind', amount: game.big_blind, timestamp: new Date().toISOString() },
      ],
    })
    .select()
    .single();

  if (handError) {
    throw new Error('Failed to create hand');
  }

  // Update game
  await supabase
    .from('poker_games')
    .update({
      current_hand_id: hand.id,
      pot: game.small_blind + game.big_blind,
    })
    .eq('id', gameId);

  // Update players with blinds
  await supabase
    .from('poker_players')
    .update({
      stack: smallBlindPlayer.stack - game.small_blind,
      current_round_bet: game.small_blind,
      total_hand_bet: game.small_blind,
      needs_to_act: true,
    })
    .eq('id', smallBlindPlayer.id);

  await supabase
    .from('poker_players')
    .update({
      stack: bigBlindPlayer.stack - game.big_blind,
      current_round_bet: game.big_blind,
      total_hand_bet: game.big_blind,
      needs_to_act: true,
    })
    .eq('id', bigBlindPlayer.id);
}

/**
 * Get count of hands played in game
 */
async function getHandCount(gameId: string): Promise<number> {
  const { count } = await supabase
    .from('poker_hands')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId);

  return count || 0;
}

/**
 * Advance to next betting round (flop → turn → river → showdown)
 */
export async function advanceToNextRound(handId: string): Promise<void> {
  const { data: hand } = await supabase
    .from('poker_hands')
    .select('*')
    .eq('id', handId)
    .single();

  if (!hand) throw new Error('Hand not found');

  let newStatus = hand.status;
  let newCommunityCards = [...hand.community_cards];

  switch (hand.status) {
    case 'preflop':
      // Reveal flop (3 cards)
      newCommunityCards = hand.all_community_cards.slice(0, 3);
      newStatus = 'flop';
      break;
    case 'flop':
      // Reveal turn (4th card)
      newCommunityCards = hand.all_community_cards.slice(0, 4);
      newStatus = 'turn';
      break;
    case 'turn':
      // Reveal river (5th card)
      newCommunityCards = hand.all_community_cards;
      newStatus = 'river';
      break;
    case 'river':
      // Go to showdown
      newStatus = 'showdown';
      await determineWinner(handId);
      return;
  }

  // Update hand
  await supabase
    .from('poker_hands')
    .update({
      status: newStatus,
      community_cards: newCommunityCards,
    })
    .eq('id', handId);

  // Reset player round bets for new betting round
  await supabase
    .from('poker_players')
    .update({
      current_round_bet: 0,
      needs_to_act: true,
    })
    .eq('game_id', hand.game_id)
    .eq('status', 'active');
}

/**
 * Determine winner and distribute pot
 */
async function determineWinner(handId: string): Promise<void> {
  const { data: hand } = await supabase
    .from('poker_hands')
    .select('*')
    .eq('id', handId)
    .single();

  if (!hand) throw new Error('Hand not found');

  const { data: players } = await supabase
    .from('poker_players')
    .select('*')
    .eq('game_id', hand.game_id)
    .neq('status', 'folded');

  if (!players || players.length === 0) return;

  // If only one player left, they win
  if (players.length === 1) {
    const winner = players[0];
    await creditWinnings(winner.id, hand.main_pot);
    
    await supabase
      .from('poker_hands')
      .update({
        status: 'complete',
        winners: [{ player_id: winner.id, amount: hand.main_pot, hand: 'Won by default' }],
      })
      .eq('id', handId);
    return;
  }

  // Evaluate all hands
  const evaluations = players.map(player => {
    const holeCards = hand.player_hands[player.id] || [];
    const allCards = [...holeCards, ...hand.community_cards];
    const best = findBestHand(allCards);
    
    return {
      playerId: player.id,
      bestHand: best.cards,
      evaluation: best.evaluation,
    };
  });

  // Sort by hand strength (highest first)
  evaluations.sort((a, b) => b.evaluation.value - a.evaluation.value);

  // Determine winner(s) - could be tie
  const winningValue = evaluations[0].evaluation.value;
  const winners = evaluations.filter(e => e.evaluation.value === winningValue);

  // RAKE LOGIC
  let potToDistribute = hand.main_pot;
  let rakeAmount = 0;

  // Only apply rake if game asset is NOT 'reward_chips'
  const { data: game } = await supabase.from('poker_games').select('asset_type, big_blind').eq('id', hand.game_id).single();
  
  if (game && game.asset_type !== 'reward_chips') {
    const RAKE_PERCENTAGE = 0.05; // 5%
    const RAKE_CAP_BB = 3; // Cap at 3 Big Blinds
    const maxRake = game.big_blind * RAKE_CAP_BB;
    
    // "No Flop, No Drop" Rule: If hand ends preflop, rake is 0
    const reachedFlop = hand.community_cards.length >= 3;
    
    if (reachedFlop) {
      rakeAmount = Math.min(hand.main_pot * RAKE_PERCENTAGE, maxRake);
      potToDistribute = hand.main_pot - rakeAmount;
      
      // Record Rake (Revenue) - Optional: Store in a 'house_revenue' table or just log for now
      // Ideally update a 'system_wallet' balance here
      console.log(`💰 Rake Collected: ${rakeAmount} (${game.asset_type}) for Hand ${handId}`);
    }
  }

  // Distribute pot
  const potShare = potToDistribute / winners.length;
  
  const winnerRecords = await Promise.all(winners.map(async (w) => {
    await creditWinnings(w.playerId, potShare);
    return {
      player_id: w.playerId,
      amount: potShare,
      hand: w.evaluation.name,
      cards: w.bestHand,
    };
  }));

  // Update hand with winners
  await supabase
    .from('poker_hands')
    .update({
      status: 'complete',
      winners: winnerRecords,
      // Store rake metadata if needed in metadata column or side_pots
      metadata: { rake_collected: rakeAmount }
    })
    .eq('id', handId);
}

/**
 * Credit winnings to player
 */
async function creditWinnings(playerId: string, amount: number): Promise<void> {
  const { data: player } = await supabase
    .from('poker_players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (!player) return;

  await supabase
    .from('poker_players')
    .update({
      stack: player.stack + amount,
      total_winnings: player.total_winnings + amount,
      hands_won: player.hands_won + 1,
    })
    .eq('id', playerId);
}

