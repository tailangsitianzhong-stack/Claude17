import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { ALL_LESSONS } from './index';

function tryMove(fen: string, uci: string): Chess | null {
  const chess = new Chess(fen);
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return chess;
  } catch {
    return null;
  }
}

/** 手番側が n 手以内に強制詰みできるか(総当たり。n<=2 向け) */
function forcedMate(fen: string, n: number): boolean {
  const chess = new Chess(fen);
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    let ok = false;
    if (chess.isCheckmate()) ok = true;
    else if (n > 1 && !chess.isGameOver()) {
      ok = chess.moves().every((r) => {
        chess.move(r);
        const res = forcedMate(chess.fen(), n - 1);
        chess.undo();
        return res;
      });
    }
    chess.undo();
    if (ok) return true;
  }
  return false;
}

describe('lesson content', () => {
  it('lesson ids are unique', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of ALL_LESSONS) {
    describe(lesson.id, () => {
      lesson.steps.forEach((step, i) => {
        if (step.type === 'move') {
          it(`step ${i}: FEN valid and answers legal`, () => {
            expect(() => new Chess(step.fen)).not.toThrow();
            if (step.answers === 'mate') {
              const chess = new Chess(step.fen);
              const mates = chess.moves({ verbose: true }).filter((m) => {
                const c = new Chess(step.fen);
                c.move(m);
                return c.isCheckmate();
              });
              expect(mates.length).toBeGreaterThan(0);
            } else {
              for (const a of step.answers) {
                expect(tryMove(step.fen, a), `answer ${a}`).not.toBeNull();
              }
            }
            if (step.hint) expect(tryMove(step.fen, step.hint)).not.toBeNull();
            for (const g of step.goals ?? []) expect(g).toMatch(/^[a-h][1-8]$/);
          });
        } else if (step.type === 'practice') {
          it(`step ${i}: practice FEN valid`, () => {
            expect(() => new Chess(step.fen)).not.toThrow();
            expect(step.maxMoves).toBeGreaterThan(0);
          });
        } else if (step.type === 'line') {
          it(`step ${i}: line plays out legally with notes`, () => {
            const chess = new Chess(step.fen);
            for (const m of step.moves) {
              expect(() => chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }), m).not.toThrow();
            }
            expect(step.notes.length).toBe(Math.ceil(step.moves.length / 2));
          });
        } else if (step.type === 'mate') {
          it(`step ${i}: mate-in-${step.moves} exists (brute force, up to 2)`, () => {
            const chess = new Chess(step.fen);
            expect(chess.isGameOver()).toBe(false);
            if (step.moves <= 2) expect(forcedMate(step.fen, step.moves)).toBe(true);
          });
        } else if (step.type === 'explain') {
          it(`step ${i}: board FEN valid`, () => {
            if (step.board) {
              expect(() => new Chess(step.board!.fen)).not.toThrow();
            }
          });
        } else {
          it(`step ${i}: quiz answer index valid`, () => {
            expect(step.answer).toBeGreaterThanOrEqual(0);
            expect(step.answer).toBeLessThan(step.choices.length);
            if (step.board) expect(() => new Chess(step.board!.fen)).not.toThrow();
          });
        }
      });
    });
  }

  it('checkmate answers deliver mate', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.type === 'move' && step.answers !== 'mate' && /チェックメイト/.test(step.success)) {
          const c = tryMove(step.fen, step.answers[0]);
          expect(c?.isCheckmate(), `${lesson.id}: ${step.text}`).toBe(true);
        }
      }
    }
  });
});
