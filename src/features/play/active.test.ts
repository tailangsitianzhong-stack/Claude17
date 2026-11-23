import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { movesOf, replayMoves } from './active';

describe('active game persistence helpers', () => {
  it('round-trips a game including castling and promotion', () => {
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6']) chess.move(san);
    const ucis = movesOf(chess);
    expect(ucis).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1', 'g8f6']);
    const restored = replayMoves(ucis);
    expect(restored?.fen()).toBe(chess.fen());

    const promo = new Chess('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    promo.move('a8=Q+');
    expect(movesOf(promo)).toEqual(['a7a8q']);
  });

  it('returns null for corrupt move lists', () => {
    expect(replayMoves(['e2e4', 'e2e4'])).toBeNull();
    expect(replayMoves(['zzzz'])).toBeNull();
  });

  it('restores an empty game', () => {
    expect(replayMoves([])?.fen()).toBe(new Chess().fen());
  });
});
