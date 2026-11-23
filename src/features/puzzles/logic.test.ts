import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { checkMove, movesOf, pickPuzzle, startPosition, updateRating, type Puzzle } from './logic';
import data from '../../../public/puzzles/puzzles.json';

const sample: Puzzle = {
  i: '00008',
  f: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  m: 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1',
  r: 1819,
  t: ['hangingPiece', 'middlegame'],
};

describe('puzzle logic', () => {
  it('sets up the position after the opponent first move', () => {
    const s = startPosition(sample);
    expect(s.playerColor).toBe('w');
    expect(s.first).toBe('f2g3');
  });

  it('accepts the expected move and rejects others', () => {
    const s = startPosition(sample);
    // 自分(白)の1手目は e6e7 が正解
    expect(checkMove(sample, 1, s.fen, 'e6e7').ok).toBe(true);
    expect(checkMove(sample, 1, s.fen, 'e6e8').ok).toBe(false);
    expect(checkMove(sample, 1, s.fen, 'a1a2').ok).toBe(false); // 違法手
  });

  it('accepts alternative checkmates', () => {
    const p: Puzzle = { i: 'x', f: '6k1/5ppp/8/8/8/8/1R6/R5K1 b - - 0 1', m: 'g8h8 a1a8', r: 800, t: ['mateIn1'] };
    const s = startPosition(p);
    // 期待手は a1a8。b2b8 でも詰みなので別解として許可
    expect(checkMove(p, 1, s.fen, 'a1a8').ok).toBe(true);
    const alt = checkMove(p, 1, s.fen, 'b2b8');
    expect(alt.ok).toBe(true);
    expect(alt.altMate).toBe(true);
  });

  it('updates rating symmetrically around expectation', () => {
    expect(updateRating(1000, 1000, true, 0)).toBe(1020);
    expect(updateRating(1000, 1000, false, 0)).toBe(980);
    expect(updateRating(1000, 1400, true, 0)).toBeGreaterThan(1030);
    expect(updateRating(400, 400, false, 100)).toBe(400);
  });

  it('picks near-rating puzzles and respects theme/seen', () => {
    const all: Puzzle[] = [
      { i: 'a', f: '', m: 'a', r: 500, t: ['fork'] },
      { i: 'b', f: '', m: 'a', r: 900, t: ['pin'] },
      { i: 'c', f: '', m: 'a', r: 1000, t: ['fork'] },
    ];
    expect(pickPuzzle(all, { rating: 950, theme: 'fork', rand: () => 0 })?.i).toBe('c');
    expect(pickPuzzle(all, { rating: 950, seen: new Set(['b', 'c']), rand: () => 0 })?.i).toBe('a');
    expect(pickPuzzle(all, { rating: 950, onlyIds: ['a'], rand: () => 0 })?.i).toBe('a');
    expect(pickPuzzle(all, { rating: 950, theme: 'skewer' })).toBeNull();
  });
});

describe('bundled puzzle data', () => {
  const puzzles = data as Puzzle[];
  it('has puzzles in a wide rating range', () => {
    expect(puzzles.length).toBeGreaterThan(1000);
    expect(Math.min(...puzzles.map((p) => p.r))).toBeLessThan(700);
    expect(Math.max(...puzzles.map((p) => p.r))).toBeGreaterThan(2200);
  });

  it('every puzzle plays out legally', () => {
    for (const p of puzzles) {
      const chess = new Chess(p.f);
      for (const m of movesOf(p)) {
        expect(() => chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }), p.i).not.toThrow();
      }
    }
  });
});
