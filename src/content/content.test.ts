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
