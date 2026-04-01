import type {
  BlackjackCardRank,
  BlackjackCardSuit,
  BlackjackDealerRevealSlots,
  BlackjackGroupedPlayerCards,
  DecodedBlackjackCardProxy,
  DecodedBlackjackDealerRevealMask
} from "./types";

export const BLACKJACK_CARD_EMPTY = 52 as const;

function toNumber(value: number | bigint) {
  return typeof value === "bigint" ? Number(value) : value;
}

function assertCardProxy(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > BLACKJACK_CARD_EMPTY) {
    throw new RangeError(`Blackjack card proxy out of range: ${value}`);
  }
}

export function decodeCardProxy(card: number | bigint): DecodedBlackjackCardProxy {
  const raw = toNumber(card);
  assertCardProxy(raw);

  if (raw === BLACKJACK_CARD_EMPTY) {
    return {
      raw,
      isEmpty: true,
      rank: null,
      suit: null
    };
  }

  return {
    raw,
    isEmpty: false,
    rank: (raw % 13) as BlackjackCardRank,
    suit: Math.floor(raw / 13) as BlackjackCardSuit
  };
}

export function decodeBlackjackDealerRevealMask(mask: number | bigint): DecodedBlackjackDealerRevealMask {
  const rawMask = toNumber(mask);
  const slots: BlackjackDealerRevealSlots = [
    (rawMask & (1 << 0)) !== 0,
    (rawMask & (1 << 1)) !== 0,
    (rawMask & (1 << 2)) !== 0,
    (rawMask & (1 << 3)) !== 0
  ];

  return {
    rawMask,
    slots
  };
}

export function groupBlackjackPlayerCards(
  playerCards: readonly (number | bigint)[],
  handCardCounts: readonly (number | bigint)[]
): BlackjackGroupedPlayerCards {
  const normalizedCards = playerCards.map((card) => {
    const raw = toNumber(card);
    assertCardProxy(raw);
    return raw;
  });
  const counts = handCardCounts.map((count) => Math.max(0, toNumber(count)));

  let offset = 0;
  const grouped = counts.map((count) => {
    const cards = normalizedCards.slice(offset, offset + count);
    offset += count;
    return cards;
  });

  while (grouped.length < 4) {
    grouped.push([]);
  }

  return [
    grouped[0] ?? [],
    grouped[1] ?? [],
    grouped[2] ?? [],
    grouped[3] ?? []
  ];
}
