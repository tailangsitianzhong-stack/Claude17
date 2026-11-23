import { Chess } from 'chess.js';

/** 1局面の評価。cp は「白から見た」センチポーン(詰みは ±10000 近辺にクランプ) */
export interface PosEval {
  cp: number;
  /** その局面で手番側のエンジン最善手(UCI)。終局局面は '' */
  best: string;
}

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const CLASS_LABEL: Record<MoveClass, string> = {
  best: '最善手',
  good: '好手',
  inaccuracy: '不正確',
  mistake: 'ミス',
  blunder: '大悪手',
};

export const CLASS_SYMBOL: Record<MoveClass, string> = {
  best: '',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

/** 勝率(%)への変換。Lichess と同じロジスティック曲線 */
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** 勝率の落ち幅(パーセントポイント)から手の評価を決める */
export function classify(loss: number, isBest: boolean): MoveClass {
  if (loss >= 30) return 'blunder';
  if (loss >= 20) return 'mistake';
  if (loss >= 10) return 'inaccuracy';
  if (isBest || loss < 1) return 'best';
  return 'good';
}

export interface MoveReview {
  /** 0始まりの手の番号(ply)。局面 ply → ply+1 の手 */
  ply: number;
  mover: 'w' | 'b';
  uci: string;
  san: string;
  /** 指す前・指した後の勝率(動かした側から見て) */
  winBefore: number;
  winAfter: number;
  loss: number;
  cls: MoveClass;
  /** エンジンの最善手(指す前の局面での) */
  bestUci: string;
  bestSan: string | null;
  /** 白から見た評価(指す前・指した後) */
  cpBefore: number;
  cpAfter: number;
  /** 日本語の説明(悪手の理由など) */
  reason: string | null;
}

export interface GameReview {
  moves: MoveReview[];
  accuracy: { w: number; b: number };
  counts: { w: Record<MoveClass, number>; b: Record<MoveClass, number> };
}

const emptyCounts = (): Record<MoveClass, number> => ({ best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 });

function uciMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] || undefined) as 'q' | 'r' | 'b' | 'n' | undefined };
}

export function sanOf(fen: string, uci: string): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move(uciMove(uci)).san;
  } catch {
    return null;
  }
}

const PIECE_NAME: Record<string, string> = { p: 'ポーン', n: 'ナイト', b: 'ビショップ', r: 'ルーク', q: 'クイーン', k: 'キング' };
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** 悪手の理由を、相手の最善応手などから推定して日本語にする */
export function explainMove(fenBefore: string, uci: string, bestUci: string, replyUci: string, cpAfterForMover: number): string | null {
  const parts: string[] = [];
  const after = new Chess(fenBefore);
  try {
    after.move(uciMove(uci));
  } catch {
    return null;
  }
  const fenAfter = after.fen();
  if (cpAfterForMover <= -9000) {
    const reply = sanOf(fenAfter, replyUci);
    parts.push(`この手のあと、詰まされる手順があります${reply ? `(相手の最善は ${reply})` : ''}。`);
  } else if (replyUci) {
    try {
      const mv = new Chess(fenAfter).move(uciMove(replyUci));
      if (mv.captured && PIECE_VALUE[mv.captured] >= 3) {
        parts.push(`この手のあと、相手に ${mv.san} で${PIECE_NAME[mv.captured]}を取られてしまいます。`);
      }
    } catch {
      /* ignore */
    }
  }
  if (bestUci) {
    try {
      const best = new Chess(fenBefore).move(uciMove(bestUci));
      if (best.san.includes('#')) parts.push(`おすすめの ${best.san} は、チェックメイトでした。`);
      else if (best.captured && PIECE_VALUE[best.captured] >= 3) parts.push(`おすすめの ${best.san} は、${PIECE_NAME[best.captured]}を取る手でした。`);
      else if (best.san.includes('+')) parts.push(`おすすめの ${best.san} は、王手で主導権を握る手でした。`);
    } catch {
      /* ignore */
    }
  }
  return parts.length ? parts.join('') : null;
}

/** 評価列と指し手列から、各手の評価・正確度を計算する(startFen は標準初期局面) */
export function reviewGame(ucis: string[], evals: PosEval[], startFen?: string): GameReview {
  const chess = new Chess(startFen);
  const moves: MoveReview[] = [];
  const counts = { w: emptyCounts(), b: emptyCounts() };
  const accSum = { w: 0, b: 0 };
  const accN = { w: 0, b: 0 };
  for (let i = 0; i < ucis.length; i++) {
    const fenBefore = chess.fen();
    const mover = chess.turn();
    const sign = mover === 'w' ? 1 : -1;
    const m = chess.move(uciMove(ucis[i]));
    const cpBefore = evals[i].cp;
    const cpAfter = evals[i + 1].cp;
    const winBefore = winPct(sign * cpBefore);
    const winAfter = winPct(sign * cpAfter);
    const loss = Math.max(0, winBefore - winAfter);
    const isBest = evals[i].best === ucis[i];
    const cls = classify(loss, isBest);
    const bestUci = evals[i].best;
    const bestSan = bestUci && bestUci !== ucis[i] ? sanOf(fenBefore, bestUci) : null;
    const reason =
      cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder'
        ? explainMove(fenBefore, ucis[i], bestUci, evals[i + 1].best, sign * cpAfter)
        : null;
    moves.push({ ply: i, mover, uci: ucis[i], san: m.san, winBefore, winAfter, loss, cls, bestUci, bestSan, cpBefore, cpAfter, reason });
    counts[mover][cls]++;
    accSum[mover] += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
    accN[mover]++;
  }
  return {
    moves,
    counts,
    accuracy: {
      w: accN.w ? accSum.w / accN.w : 100,
      b: accN.b ? accSum.b / accN.b : 100,
    },
  };
}

/** 評価の表示(ポーン単位)。詰みに近い値は「詰み」 */
export function fmtEval(cp: number): string {
  if (Math.abs(cp) >= 9000) return cp > 0 ? '白の詰み' : '黒の詰み';
  const v = cp / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

/** エンジン評価(手番側から見た cp・mate)を、白から見た ±10000 以内の値にする */
export function toWhiteCp(turn: 'w' | 'b', cp: number): number {
  const w = turn === 'w' ? cp : -cp;
  return Math.max(-10000, Math.min(10000, Math.round(w)));
}

/** 終局局面の評価(白から見た cp) */
export function terminalCp(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 : 10000;
  return 0;
}
