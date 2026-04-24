/**
 * Card Utilities
 * 
 * Poker card manipulation, deck generation, and hand evaluation.
 * Extracted and adapted from XBTC-Vercel poker engine.
 */

// Card constants
export const CARD_SUITS = ['H', 'D', 'C', 'S'] as const; // Hearts, Diamonds, Clubs, Spades
export const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export type Suit = typeof CARD_SUITS[number];
export type Rank = typeof CARD_RANKS[number];
export type Card = string; // Format: "AH" (Ace of Hearts)

/**
 * Generate a shuffled deck of 52 cards
 */
export function generateDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push(rank + suit);
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Deal cards from deck
 */
export function dealCards(deck: Card[], count: number): Card[] {
  return deck.splice(0, count);
}

/**
 * Get numeric value of card rank
 */
export function getCardRankValue(card: Card): number {
  const rank = card[0];
  switch (rank) {
    case 'A': return 14;
    case 'K': return 13;
    case 'Q': return 12;
    case 'J': return 11;
    case 'T': return 10;
    default: return parseInt(rank, 10);
  }
}

/**
 * Get card suit
 */
export function getCardSuit(card: Card): Suit {
  return card[1] as Suit;
}

/**
 * Format card for display (e.g., "AH" -> "A♥")
 */
export function formatCard(card: Card): string {
  const rank = card[0];
  const suit = card[1];

  const suitSymbols: Record<string, string> = {
    'H': '♥',
    'D': '♦',
    'C': '♣',
    'S': '♠'
  };

  return rank + (suitSymbols[suit] || suit);
}

/**
 * Format multiple cards
 */
export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * Evaluate poker hand
 * Returns: [handRank, highCards]
 * handRank: 9=Royal Flush, 8=Straight Flush, ..., 1=High Card
 */
export function evaluateHand(cards: Card[]): { rank: number; value: number; name: string } {
  if (cards.length < 5) {
    return { rank: 0, value: 0, name: 'Invalid Hand' };
  }

  // Sort cards by rank value (descending)
  const sorted = [...cards].sort((a, b) => getCardRankValue(b) - getCardRankValue(a));

  const ranks = sorted.map(c => c[0]);
  const suits = sorted.map(c => c[1]);
  const values = sorted.map(getCardRankValue);

  // Check for flush
  const isFlush = suits.every(s => s === suits[0]);

  // Check for straight
  const isStraight = checkStraight(values);
  const isLowStraight = checkLowStraight(values); // A-2-3-4-5

  // Royal Flush
  if (isFlush && isStraight && values[0] === 14) {
    return { rank: 10, value: 10000000, name: 'Royal Flush' };
  }

  // Straight Flush
  if (isFlush && (isStraight || isLowStraight)) {
    return { rank: 9, value: 9000000 + values[0], name: 'Straight Flush' };
  }

  // Four of a Kind
  const fourKind = checkNOfKind(values, 4);
  if (fourKind) {
    return { rank: 8, value: 8000000 + fourKind * 100, name: 'Four of a Kind' };
  }

  // Full House
  const threeKind = checkNOfKind(values, 3);
  const pair = checkNOfKind(values, 2);
  if (threeKind && pair) {
    return { rank: 7, value: 7000000 + threeKind * 100 + pair, name: 'Full House' };
  }

  // Flush
  if (isFlush) {
    return { rank: 6, value: 6000000 + values[0], name: 'Flush' };
  }

  // Straight
  if (isStraight || isLowStraight) {
    return { rank: 5, value: 5000000 + values[0], name: 'Straight' };
  }

  // Three of a Kind
  if (threeKind) {
    return { rank: 4, value: 4000000 + threeKind * 100, name: 'Three of a Kind' };
  }

  // Two Pair
  const pairs = checkTwoPair(values);
  if (pairs) {
    return { rank: 3, value: 3000000 + pairs[0] * 100 + pairs[1], name: 'Two Pair' };
  }

  // One Pair
  if (pair) {
    return { rank: 2, value: 2000000 + pair * 100, name: 'One Pair' };
  }

  // High Card
  return { rank: 1, value: 1000000 + values[0], name: 'High Card' };
}

function checkStraight(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) return false;
  }
  return true;
}

function checkLowStraight(values: number[]): boolean {
  // A-2-3-4-5
  return values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2;
}

function checkNOfKind(values: number[], n: number): number | null {
  const counts = new Map<number, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));

  for (const [value, count] of counts.entries()) {
    if (count === n) return value;
  }
  return null;
}

function checkTwoPair(values: number[]): [number, number] | null {
  const counts = new Map<number, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));

  const pairs: number[] = [];
  for (const [value, count] of counts.entries()) {
    if (count === 2) pairs.push(value);
  }

  if (pairs.length >= 2) {
    pairs.sort((a, b) => b - a);
    return [pairs[0], pairs[1]];
  }
  return null;
}

/**
 * Find best 5-card hand from 7 cards
 */
export function findBestHand(cards: Card[]): { cards: Card[]; evaluation: ReturnType<typeof evaluateHand> } {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }

  if (cards.length === 5) {
    return { cards, evaluation: evaluateHand(cards) };
  }

  // Generate all 5-card combinations from 7 cards
  let bestHand: Card[] = [];
  let bestEval = { rank: 0, value: 0, name: '' };

  function combinations(arr: Card[], k: number): Card[][] {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];

    const first = arr[0];
    const rest = arr.slice(1);

    const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = combinations(rest, k);

    return [...withFirst, ...withoutFirst];
  }

  const allCombos = combinations(cards, 5);

  for (const combo of allCombos) {
    const handEvaluation = evaluateHand(combo);
    if (handEvaluation.value > bestEval.value) {
      bestEval = handEvaluation;
      bestHand = combo;
    }
  }

  return { cards: bestHand, evaluation: bestEval };
}

