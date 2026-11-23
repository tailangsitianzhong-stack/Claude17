import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classify, fmtEval, reviewGame, terminalCp, toWhiteCp, winPct, type PosEval } from './logic';

describe('analysis logic', () => {
  it('winPct is symmetric and bounded', () => {
    expect(winPct(0)).toBeCloseTo(50, 5);
    expect(winPct(300) + winPct(-300)).toBeCloseTo(100, 5);
    expect(winPct(10000)).toBeGreaterThan(99);
    expect(winPct(100)).toBeGreaterThan(winPct(50));
  });

  it('classifies by win% loss thresholds', () => {
    expect(classify(0, true)).toBe('best');
    expect(classify(3, false)).toBe('good');
    expect(classify(12, false)).toBe('inaccuracy');
    expect(classify(25, false)).toBe('mistake');
    expect(classify(40, true)).toBe('blunder');
  });

  it('reviews a short game: blunder is flagged with reason', () => {
    // 1.e4 e5 2.Qh5 (best-ish) Nc6 3.Qxf7?? is not legal; use a clean example:
    // 1.f3 e5 2.g4?? Qh4# — 白の2手目が大悪手(詰まされる)
    const ucis = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    const chess = new Chess();
    const evals: PosEval[] = [];
    const cps = [10, -20, -30, 10000]; // 局面ごとの白から見た評価(最後は詰まされ)
    // positions: start, after f3, after e5, after g4, after Qh4#
    const fens: string[] = [chess.fen()];
    for (const u of ucis) {
      chess.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
      fens.push(chess.fen());
    }
    evals.push({ cp: 20, best: 'e2e4' });
    evals.push({ cp: -10, best: 'e7e5' });
    evals.push({ cp: -30, best: 'd2d4' });
    evals.push({ cp: -10000, best: 'd8h4' });
    evals.push({ cp: terminalCp(chess), best: '' });
    void cps;
    const review = reviewGame(ucis, evals);
    expect(review.moves).toHaveLength(4);
    const g4 = review.moves[2];
    expect(g4.san).toBe('g4');
    expect(g4.cls).toBe('blunder');
    expect(g4.bestSan).toBe('d4');
    expect(g4.reason).toContain('詰まされる');
    expect(review.moves[3].cls).toBe('best');
    expect(review.accuracy.w).toBeLessThan(review.accuracy.b);
    expect(review.counts.w.blunder).toBe(1);
  });

  it('formats eval and converts perspectives', () => {
    expect(fmtEval(150)).toBe('+1.5');
    expect(fmtEval(-80)).toBe('-0.8');
    expect(fmtEval(10000)).toBe('白の詰み');
    expect(toWhiteCp('b', 200)).toBe(-200);
    expect(toWhiteCp('w', 99999)).toBe(10000);
  });
});
