/**
 * PROVEN POKER HAND EVALUATION ENGINE
 * Extracted from XBTC production poker backend
 * Adapted for Supabase schema
 * 
 * Handles:
 * - All 9 poker hand rankings (Royal Flush to High Card)
 * - Kicker comparison
 * - Best 5-card selection from 7 cards
 * - Winner determination
 * - Side pot calculation
 * - Tie-breaking rules
 */

// --- Constants and Types ---
export const CARD_RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['H', 'D', 'C', 'S'] as const;
export type Suit = (typeof SUITS)[number];

export interface CardData {
  rank: string;
  suit: Suit;
}

export interface EvaluatedCard extends CardData {
  value: number; // 2-14 (A=14)
}

export const HAND_HIERARCHY = {
  HIGH_CARD: { rank: 1, name: 'High Card' },
  ONE_PAIR: { rank: 2, name: 'One Pair' },
  TWO_PAIR: { rank: 3, name: 'Two Pair' },
  THREE_OF_A_KIND: { rank: 4, name: 'Three of a Kind' },
  STRAIGHT: { rank: 5, name: 'Straight' },
  FLUSH: { rank: 6, name: 'Flush' },
  FULL_HOUSE: { rank: 7, name: 'Full House' },
  FOUR_OF_A_KIND: { rank: 8, name: 'Four of a Kind' },
  STRAIGHT_FLUSH: { rank: 9, name: 'Straight Flush' },
} as const;

export type HandRankName = (typeof HAND_HIERARCHY)[keyof typeof HAND_HIERARCHY]['name'];

export interface EvaluatedHand {
  handName: HandRankName;
  handRank: number;
  significantCards: number[];
  kickers: number[];
  best5Cards: EvaluatedCard[];
}

export interface PlayerForEvaluation {
  player_id: string;
  wallet_address: string;
  hole_cards: string[]; // e.g., ['AS', 'KH']
  status: string;
  stack: number;
  total_hand_bet: number;
}

export interface WinnerResult {
  player_id: string;
  wallet_address: string;
  hand_name: string;
  hand_description: string;
  best_cards: string[];
  win_amount: number;
  pot_type: string; // 'main' or 'side_1', 'side_2', etc.
}

// --- Helper Functions ---

export function getCardValue(rank: string): number {
  const upperRank = rank.toUpperCase();
  if (upperRank === 'A') return 14;
  if (upperRank === 'K') return 13;
  if (upperRank === 'Q') return 12;
  if (upperRank === 'J') return 11;
  if (upperRank === 'T') return 10;
  return parseInt(upperRank, 10);
}

function toEvaluatedCard(card: CardData): EvaluatedCard {
  return { ...card, value: getCardValue(card.rank) };
}

function sortCards(cards: EvaluatedCard[]): EvaluatedCard[] {
  return [...cards].sort((a, b) => b.value - a.value);
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  if (arr.length === k) return [arr];
  if (k === 1) return arr.map((item) => [item]);

  const head = arr[0];
  const tail = arr.slice(1);

  const withHead = getCombinations(tail, k - 1).map((combo) => [head, ...combo]);
  const withoutHead = getCombinations(tail, k);

  return [...withHead, ...withoutHead];
}

// --- Hand Checking Functions (evaluate a 5-card hand) ---

function checkStraightFlush(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const flushSuit = cards[0].suit;
  if (cards.every((c) => c.suit === flushSuit)) {
    let isStraight = true;
    for (let i = 0; i < 4; i++) {
      if (cards[i].value !== cards[i + 1].value + 1) {
        isStraight = false;
        break;
      }
    }
    if (
      !isStraight &&
      cards[0].value === 14 &&
      cards[1].value === 5 &&
      cards[2].value === 4 &&
      cards[3].value === 3 &&
      cards[4].value === 2
    ) {
      // A-5 straight (wheel)
      return {
        handName: HAND_HIERARCHY.STRAIGHT_FLUSH.name,
        handRank: HAND_HIERARCHY.STRAIGHT_FLUSH.rank,
        significantCards: [5],
        kickers: [],
      };
    }
    if (isStraight) {
      return {
        handName: HAND_HIERARCHY.STRAIGHT_FLUSH.name,
        handRank: HAND_HIERARCHY.STRAIGHT_FLUSH.rank,
        significantCards: [cards[0].value],
        kickers: [],
      };
    }
  }
  return null;
}

function checkFourOfAKind(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const counts: { [value: number]: number } = {};
  cards.forEach((c) => (counts[c.value] = (counts[c.value] || 0) + 1));

  for (const valueStr in counts) {
    const value = parseInt(valueStr);
    if (counts[value] === 4) {
      const kicker = cards.find((c) => c.value !== value)!.value;
      return {
        handName: HAND_HIERARCHY.FOUR_OF_A_KIND.name,
        handRank: HAND_HIERARCHY.FOUR_OF_A_KIND.rank,
        significantCards: [value],
        kickers: [kicker],
      };
    }
  }
  return null;
}

function checkFullHouse(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const counts: { [value: number]: number } = {};
  cards.forEach((c) => (counts[c.value] = (counts[c.value] || 0) + 1));

  let threeValue = -1;
  let pairValue = -1;

  for (const valueStr in counts) {
    const value = parseInt(valueStr);
    if (counts[value] === 3) threeValue = value;
    else if (counts[value] === 2) pairValue = value;
  }

  if (threeValue !== -1 && pairValue !== -1) {
    return {
      handName: HAND_HIERARCHY.FULL_HOUSE.name,
      handRank: HAND_HIERARCHY.FULL_HOUSE.rank,
      significantCards: [threeValue, pairValue],
      kickers: [],
    };
  }
  return null;
}

function checkFlush(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  if (cards.every((c) => c.suit === cards[0].suit)) {
    return {
      handName: HAND_HIERARCHY.FLUSH.name,
      handRank: HAND_HIERARCHY.FLUSH.rank,
      significantCards: cards.map((c) => c.value),
      kickers: [],
    };
  }
  return null;
}

function checkStraight(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  let isStraight = true;
  for (let i = 0; i < 4; i++) {
    if (cards[i].value !== cards[i + 1].value + 1) {
      isStraight = false;
      break;
    }
  }
  // Check for A-5 straight (wheel: A,2,3,4,5)
  if (
    !isStraight &&
    cards[0].value === 14 &&
    cards[1].value === 5 &&
    cards[2].value === 4 &&
    cards[3].value === 3 &&
    cards[4].value === 2
  ) {
    return {
      handName: HAND_HIERARCHY.STRAIGHT.name,
      handRank: HAND_HIERARCHY.STRAIGHT.rank,
      significantCards: [5], // High card of wheel is 5 for comparison
      kickers: [],
    };
  }
  if (isStraight) {
    return {
      handName: HAND_HIERARCHY.STRAIGHT.name,
      handRank: HAND_HIERARCHY.STRAIGHT.rank,
      significantCards: [cards[0].value], // High card of straight
      kickers: [],
    };
  }
  return null;
}

function checkThreeOfAKind(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const counts: { [value: number]: number } = {};
  cards.forEach((c) => (counts[c.value] = (counts[c.value] || 0) + 1));

  for (const valueStr in counts) {
    const value = parseInt(valueStr);
    if (counts[value] === 3) {
      const kickers = sortCards(cards.filter((c) => c.value !== value)).map((c) => c.value);
      return {
        handName: HAND_HIERARCHY.THREE_OF_A_KIND.name,
        handRank: HAND_HIERARCHY.THREE_OF_A_KIND.rank,
        significantCards: [value],
        kickers: kickers.slice(0, 2),
      };
    }
  }
  return null;
}

function checkTwoPair(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const counts: { [value: number]: number } = {};
  cards.forEach((c) => (counts[c.value] = (counts[c.value] || 0) + 1));

  const pairs: number[] = [];
  for (const valueStr in counts) {
    if (counts[parseInt(valueStr)] === 2) {
      pairs.push(parseInt(valueStr));
    }
  }

  if (pairs.length >= 2) {
    pairs.sort((a, b) => b - a);
    const highPair = pairs[0];
    const lowPair = pairs[1];
    const kicker = cards.find((c) => c.value !== highPair && c.value !== lowPair)!.value;
    return {
      handName: HAND_HIERARCHY.TWO_PAIR.name,
      handRank: HAND_HIERARCHY.TWO_PAIR.rank,
      significantCards: [highPair, lowPair],
      kickers: [kicker],
    };
  }
  return null;
}

function checkOnePair(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> | null {
  const counts: { [value: number]: number } = {};
  cards.forEach((c) => (counts[c.value] = (counts[c.value] || 0) + 1));

  for (const valueStr in counts) {
    const value = parseInt(valueStr);
    if (counts[value] === 2) {
      const kickers = sortCards(cards.filter((c) => c.value !== value)).map((c) => c.value);
      return {
        handName: HAND_HIERARCHY.ONE_PAIR.name,
        handRank: HAND_HIERARCHY.ONE_PAIR.rank,
        significantCards: [value],
        kickers: kickers.slice(0, 3),
      };
    }
  }
  return null;
}

function getHighCard(cards: EvaluatedCard[]): Omit<EvaluatedHand, 'best5Cards'> {
  const cardValues = cards.map((c) => c.value);
  const [highCard, ...kickers] = cardValues; // cardValues is already sorted high to low
  return {
    handName: HAND_HIERARCHY.HIGH_CARD.name,
    handRank: HAND_HIERARCHY.HIGH_CARD.rank,
    significantCards: [highCard],
    kickers: kickers,
  };
}

// --- Main Evaluation Function ---
export function evaluate5Cards(fiveCards: EvaluatedCard[]): EvaluatedHand {
  const sorted5 = sortCards(fiveCards);

  const straightFlush = checkStraightFlush(sorted5);
  if (straightFlush) return { ...straightFlush, best5Cards: sorted5 };

  const fourOfAKind = checkFourOfAKind(sorted5);
  if (fourOfAKind) return { ...fourOfAKind, best5Cards: sorted5 };

  const fullHouse = checkFullHouse(sorted5);
  if (fullHouse) return { ...fullHouse, best5Cards: sorted5 };

  const flush = checkFlush(sorted5);
  if (flush) return { ...flush, best5Cards: sorted5 };

  const straight = checkStraight(sorted5);
  if (straight) return { ...straight, best5Cards: sorted5 };

  const threeOfAKind = checkThreeOfAKind(sorted5);
  if (threeOfAKind) return { ...threeOfAKind, best5Cards: sorted5 };

  const twoPair = checkTwoPair(sorted5);
  if (twoPair) return { ...twoPair, best5Cards: sorted5 };

  const onePair = checkOnePair(sorted5);
  if (onePair) return { ...onePair, best5Cards: sorted5 };

  return { ...getHighCard(sorted5), best5Cards: sorted5 };
}

/**
 * Evaluate best 5-card hand from 7 cards (2 hole + 5 community)
 */
export function evaluate7Cards(holeCards: CardData[], communityCards: CardData[]): EvaluatedHand {
  // Validate inputs
  if (!holeCards || !communityCards) {
    throw new Error('Invalid cards provided to evaluate7Cards');
  }

  // Filter out null/undefined cards
  const validHoleCards = holeCards.filter(card => card && card.rank && card.suit);
  const validCommunityCards = communityCards.filter(card => card && card.rank && card.suit);

  // Need at least 5 cards total to evaluate
  if (validHoleCards.length + validCommunityCards.length < 5) {
    throw new Error('Not enough valid cards to evaluate hand');
  }

  // Convert all cards to EvaluatedCards
  const allCards = [...validHoleCards, ...validCommunityCards].map(toEvaluatedCard);

  // Get all possible 5-card combinations from available cards
  const combinations = getCombinations(allCards, 5);

  if (combinations.length === 0) {
    throw new Error('No valid card combinations found');
  }

  // Evaluate each 5-card hand
  const evaluatedHands = combinations.map((cards) => evaluate5Cards(cards));

  // Return the best hand
  return evaluatedHands.reduce((best, current) => {
    return compareEvaluatedHands(best, current) < 0 ? current : best;
  });
}

/**
 * Compare two evaluated hands
 * Returns: > 0 if handA wins, < 0 if handB wins, 0 if tie
 */
export function compareEvaluatedHands(handA: EvaluatedHand, handB: EvaluatedHand): number {
  // Compare hand ranks first
  if (handA.handRank !== handB.handRank) {
    return handA.handRank - handB.handRank;
  }

  // Same rank, compare significant cards
  for (let i = 0; i < handA.significantCards.length; i++) {
    if (i >= handB.significantCards.length) return 1;
    if (handA.significantCards[i] !== handB.significantCards[i]) {
      return handA.significantCards[i] - handB.significantCards[i];
    }
  }
  if (handB.significantCards.length > handA.significantCards.length) return -1;

  // Same significant cards, compare kickers
  for (let i = 0; i < handA.kickers.length; i++) {
    if (i >= handB.kickers.length) return 1;
    if (handA.kickers[i] !== handB.kickers[i]) {
      return handA.kickers[i] - handB.kickers[i];
    }
  }
  if (handB.kickers.length > handA.kickers.length) return -1;

  return 0; // Perfect tie
}

/**
 * Parse card string to CardData
 * e.g., 'AS' → { rank: 'A', suit: 'S' }
 */
export function parseCard(cardStr: string): CardData {
  if (!cardStr || cardStr.length < 2) {
    throw new Error(`Invalid card string: ${cardStr}`);
  }
  const rank = cardStr.charAt(0);
  const suit = cardStr.charAt(1) as Suit;
  return { rank, suit };
}

/**
 * Determine winner(s) from a list of players
 * Adapted for Supabase poker_players schema
 */
export function determineWinnersFromPlayers(
  players: PlayerForEvaluation[],
  communityCards: string[],
  totalPot: number
): WinnerResult[] {
  // CRITICAL: Only evaluate non-folded players
  const activePlayers = players.filter(p => p.status !== 'folded');

  console.log('🔍 PokerLogic - Input players:', players.map(p => ({
    wallet: p.wallet_address.slice(0, 10),
    status: p.status,
    folded: p.status === 'folded'
  })));

  console.log('🔍 PokerLogic - Filtered to active players:', activePlayers.map(p => ({
    wallet: p.wallet_address.slice(0, 10),
    status: p.status
  })));

  if (activePlayers.length === 0) {
    throw new Error('No active players for showdown - all players folded!');
  }

  if (activePlayers.length === 1) {
    // Single winner by default
    return [{
      player_id: activePlayers[0].player_id,
      wallet_address: activePlayers[0].wallet_address,
      hand_name: 'Win by Default',
      hand_description: 'All others folded',
      best_cards: [],
      win_amount: totalPot,
      pot_type: 'main'
    }];
  }

  // Parse community cards
  const communityCardObjects = communityCards.map(parseCard);

  // Evaluate each player's hand
  const playerHands: { player: PlayerForEvaluation; hand: EvaluatedHand }[] = [];

  console.log('🎴 Community cards:', communityCards.join(', '));

  for (const player of activePlayers) {
    try {
      const holeCardObjects = player.hole_cards.map(parseCard);
      const evaluatedHand = evaluate7Cards(holeCardObjects, communityCardObjects);
      playerHands.push({ player, hand: evaluatedHand });

      // Detailed logging for debugging
      console.log(`🃏 Player ${player.wallet_address.slice(0, 10)} hand evaluation:`, {
        holeCards: player.hole_cards.join(', '),
        handName: evaluatedHand.handName,
        handRank: evaluatedHand.handRank,
        significantCards: evaluatedHand.significantCards,
        kickers: evaluatedHand.kickers,
        best5Cards: evaluatedHand.best5Cards.map(c => `${c.rank}${c.suit}`).join(', ')
      });
    } catch (error) {
      console.error(`Error evaluating hand for ${player.wallet_address}:`, error);
      // Skip players with invalid cards
    }
  }

  if (playerHands.length === 0) {
    throw new Error('Could not evaluate any player hands');
  }

  // Find the best hand(s)
  let bestHand = playerHands[0].hand;
  let winners = [playerHands[0]];

  for (let i = 1; i < playerHands.length; i++) {
    const comparison = compareEvaluatedHands(playerHands[i].hand, bestHand);
    if (comparison > 0) {
      // This hand is better
      bestHand = playerHands[i].hand;
      winners = [playerHands[i]];
    } else if (comparison === 0) {
      // Tie - add to winners
      winners.push(playerHands[i]);
    }
  }

  // Distribute pot among winners
  // NOTE: Don't use Math.floor for cash games - it truncates decimals to 0!
  // For SOL/USDC, preserve decimals. For reward chips, floor is fine.
  // We'll round to 8 decimal places to avoid floating point issues
  const winAmount = Math.round((totalPot / winners.length) * 100000000) / 100000000;

  console.log(`🏆 Winner(s) determined:`, winners.map(w => ({
    wallet: w.player.wallet_address.slice(0, 10),
    hand: w.hand.handName,
    rank: w.hand.handRank,
    significant: w.hand.significantCards,
    best5: w.hand.best5Cards.map(c => `${c.rank}${c.suit}`).join(', ')
  })));

  const winnerResults = winners.map(({ player, hand }) => ({
    player_id: player.player_id,
    wallet_address: player.wallet_address,
    hand_name: hand.handName,
    hand_description: formatHandDescription(hand),
    best_cards: hand.best5Cards.map(c => `${c.rank}${c.suit}`),
    win_amount: winAmount,
    pot_type: 'main'
  }));

  // FINAL SAFETY CHECK: Ensure NO folded players in winners!
  const foldedWinners = winnerResults.filter(w => {
    const originalPlayer = players.find(p => p.player_id === w.player_id);
    return originalPlayer?.status === 'folded';
  });

  if (foldedWinners.length > 0) {
    console.error('🚨 CRITICAL BUG: Folded players in winners array!', foldedWinners);
    throw new Error('Folded players cannot win - logic error detected!');
  }

  console.log('✅ Winner validation passed - no folded players in results');

  return winnerResults;
}

/**
 * Format hand description for display
 * e.g., "Flush, Ace high" or "Full House, Kings over Tens"
 */
function formatHandDescription(hand: EvaluatedHand): string {
  const rankName = (val: number) => {
    if (val === 14) return 'Ace';
    if (val === 13) return 'King';
    if (val === 12) return 'Queen';
    if (val === 11) return 'Jack';
    if (val === 10) return 'Ten';
    return val.toString();
  };

  switch (hand.handName) {
    case 'Straight Flush':
      return `Straight Flush, ${rankName(hand.significantCards[0])} high`;
    case 'Four of a Kind':
      return `Four ${rankName(hand.significantCards[0])}s`;
    case 'Full House':
      return `Full House, ${rankName(hand.significantCards[0])}s over ${rankName(hand.significantCards[1])}s`;
    case 'Flush':
      return `Flush, ${rankName(hand.significantCards[0])} high`;
    case 'Straight':
      return `Straight, ${rankName(hand.significantCards[0])} high`;
    case 'Three of a Kind':
      return `Three ${rankName(hand.significantCards[0])}s`;
    case 'Two Pair':
      return `Two Pair, ${rankName(hand.significantCards[0])}s and ${rankName(hand.significantCards[1])}s`;
    case 'One Pair':
      return `Pair of ${rankName(hand.significantCards[0])}s`;
    case 'High Card':
      return `${rankName(hand.significantCards[0])} high`;
    default:
      return hand.handName;
  }
}

/**
 * Calculate side pots for all-in situations
 * Adapted for Supabase schema
 */
export function calculateSidePots(
  players: PlayerForEvaluation[],
  totalPot: number
): { mainPotAmount: number; sidePots: Array<{ amount: number; eligiblePlayerIds: string[] }> } {
  const activePlayers = players.filter(p => p.status !== 'folded');

  // Check if all players bet the same amount (no side pots needed)
  const bets = activePlayers.map(p => p.total_hand_bet);
  const minBet = Math.min(...bets);
  const maxBet = Math.max(...bets);

  if (minBet === maxBet || activePlayers.length <= 1) {
    return { mainPotAmount: totalPot, sidePots: [] };
  }

  // Create side pots for different bet levels
  const sidePots: Array<{ amount: number; eligiblePlayerIds: string[] }> = [];
  const sortedPlayers = [...activePlayers]
    .sort((a, b) => a.total_hand_bet - b.total_hand_bet);

  let processedAmount = 0;

  for (let i = 0; i < sortedPlayers.length; i++) {
    const currentLevel = sortedPlayers[i].total_hand_bet;
    const contribution = currentLevel - processedAmount;

    if (contribution <= 0) continue;

    // Players who bet at least this amount are eligible
    const eligiblePlayers = activePlayers.filter(p => p.total_hand_bet >= currentLevel);
    const eligiblePlayerIds = eligiblePlayers.map(p => p.player_id);

    // Calculate pot amount (each eligible player contributes)
    const potAmount = contribution * eligiblePlayers.length;

    sidePots.push({
      amount: potAmount,
      eligiblePlayerIds
    });

    processedAmount = currentLevel;
  }

  return { mainPotAmount: sidePots.length > 0 ? 0 : totalPot, sidePots };
}
