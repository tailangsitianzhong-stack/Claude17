import { Chess } from 'chess.js';
import { getEngine } from '../../engine/stockfish';
import { terminalCp, toWhiteCp, type PosEval } from './logic';

export interface CancelToken {
  cancelled: boolean;
}

/** 指し手列(UCI)の各局面(開始局面〜最終局面)をエンジンで評価する */
export async function analyzeMoves(
  ucis: string[],
  onProgress: (done: number, total: number) => void,
  token: CancelToken,
): Promise<PosEval[] | null> {
  const engine = getEngine();
  await engine.init();
  const chess = new Chess();
  const evals: PosEval[] = [];
  const total = ucis.length + 1;
  for (let i = 0; i < total; i++) {
    if (token.cancelled) return null;
    if (chess.isGameOver()) {
      evals.push({ cp: terminalCp(chess), best: '' });
    } else {
      const ev = await engine.analyze(chess.fen(), { depth: 12, movetime: 350 });
      if (token.cancelled) return null;
      evals.push({
        cp: toWhiteCp(chess.turn(), ev.cp),
        best: ev.bestMove && ev.bestMove !== '(none)' ? ev.bestMove : '',
      });
    }
    onProgress(i + 1, total);
    if (i < ucis.length) {
      const u = ucis[i];
      chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] || undefined) as 'q' | 'r' | 'b' | 'n' | undefined });
    }
  }
  return evals;
}
