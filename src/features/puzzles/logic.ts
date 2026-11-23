import { Chess } from 'chess.js';

/** Lichess オープンパズル(CC0)から抜粋した1問 */
export interface Puzzle {
  /** PuzzleId */
  i: string;
  /** 相手の最初の1手を指す前の FEN */
  f: string;
  /** UCI の手順。先頭は相手の手、その後は自分→相手→自分… */
  m: string;
  /** パズルのレーティング */
  r: number;
  /** テーマ */
  t: string[];
}

export function movesOf(p: Puzzle): string[] {
  return p.m.split(' ');
}

export function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined,
  };
}

/** 相手の最初の手を指した後の局面 */
export function startPosition(p: Puzzle): { fen: string; playerColor: 'w' | 'b'; first: string } {
  const chess = new Chess(p.f);
  const first = movesOf(p)[0];
  chess.move(uciToMove(first));
  return { fen: chess.fen(), playerColor: chess.turn(), first };
}

export interface MoveCheck {
  ok: boolean;
  /** 解答手順にない別解だが、チェックメイトになる手(正解として扱う) */
  altMate: boolean;
}

/** idx 番目(自分の手)に対する指し手の判定 */
export function checkMove(p: Puzzle, idx: number, fenBefore: string, uci: string): MoveCheck {
  const expected = movesOf(p)[idx];
  if (uci === expected) return { ok: true, altMate: false };
  try {
    const chess = new Chess(fenBefore);
    chess.move(uciToMove(uci));
    if (chess.isCheckmate()) return { ok: true, altMate: true };
  } catch {
    /* 違法手 */
  }
  return { ok: false, altMate: false };
}

/** Elo 方式のレーティング更新(最初は大きめ、慣れたら小さめ) */
export function updateRating(userRating: number, puzzleRating: number, win: boolean, games: number): number {
  const k = games < 30 ? 40 : 24;
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
  const next = userRating + k * ((win ? 1 : 0) - expected);
  return Math.max(400, Math.round(next));
}

export interface PickOptions {
  rating: number;
  theme?: string | null;
  seen?: ReadonlySet<string>;
  /** 復習モード: これらの ID のみから選ぶ */
  onlyIds?: readonly string[];
  rand?: () => number;
}

/** レーティングが近い未出題のパズルからランダムに選ぶ */
export function pickPuzzle(all: Puzzle[], opts: PickOptions): Puzzle | null {
  const rand = opts.rand ?? Math.random;
  let pool = all;
  if (opts.onlyIds) {
    const ids = new Set(opts.onlyIds);
    pool = pool.filter((p) => ids.has(p.i));
  }
  if (opts.theme) pool = pool.filter((p) => p.t.includes(opts.theme!));
  if (pool.length === 0) return null;
  const fresh = opts.seen ? pool.filter((p) => !opts.seen!.has(p.i)) : pool;
  const base = fresh.length > 0 && !opts.onlyIds ? fresh : pool;
  const sorted = [...base].sort(
    (a, b) => Math.abs(a.r - opts.rating) - Math.abs(b.r - opts.rating) || a.i.localeCompare(b.i),
  );
  const near = sorted.slice(0, Math.min(10, sorted.length));
  return near[Math.floor(rand() * near.length)];
}

let cache: Promise<Puzzle[]> | null = null;

export function loadPuzzles(): Promise<Puzzle[]> {
  if (!cache) {
    const url = new URL('puzzles/puzzles.json', document.baseURI).toString();
    cache = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`puzzle load failed: ${r.status}`);
        return r.json() as Promise<Puzzle[]>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
