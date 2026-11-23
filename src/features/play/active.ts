import { Chess } from 'chess.js';

/** 局面を進めた手の列(UCI)にする */
export function movesOf(chess: Chess): string[] {
  return chess.history({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
}

/** 保存した手順(UCI)から対局を復元する。不正な手が含まれていたら null */
export function replayMoves(ucis: string[]): Chess | null {
  const chess = new Chess();
  try {
    for (const u of ucis) {
      chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] || undefined) as 'q' | 'r' | 'b' | 'n' | undefined });
    }
  } catch {
    return null;
  }
  return chess;
}
