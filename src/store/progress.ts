/** XP・連続学習日数・バッジの純粋ロジック(ストアから切り離してテストしやすくする) */

export interface Streak {
  current: number;
  best: number;
  /** 最後に学習した日(ローカル日付 YYYY-MM-DD) */
  last: string | null;
}

export const DAILY_GOAL_XP = 30;

/** ローカル日付のキー(YYYY-MM-DD) */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** n 日前のキー */
export function daysAgoKey(n: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
  return dateKey(d);
}

/** 今日の学習を記録したときの連続日数 */
export function nextStreak(prev: Streak, today: string): Streak {
  if (prev.last === today) return prev;
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = dateKey(new Date(y, m - 1, d - 1));
  const current = prev.last === yesterday ? prev.current + 1 : 1;
  return { current, best: Math.max(prev.best, current), last: today };
}

/** 画面に表示する連続日数。最後の学習が昨日より前なら途切れている(0) */
export function visibleStreak(s: Streak, today: string = dateKey()): number {
  if (!s.last) return 0;
  if (s.last === today) return s.current;
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = dateKey(new Date(y, m - 1, d - 1));
  return s.last === yesterday ? s.current : 0;
}

/** レベル(ランク)。必要XPは 40 × (レベル-1)^2 */
export function xpForLevel(level: number): number {
  return 40 * (level - 1) * (level - 1);
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
}

export function levelProgress(xp: number): { level: number; into: number; need: number } {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, need: next - base };
}

/** 直近 90 日分だけ残す */
export function pruneActivity(a: Record<string, number>, today: string = dateKey()): Record<string, number> {
  const [y, m, d] = today.split('-').map(Number);
  const limit = dateKey(new Date(y, m - 1, d - 90));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(a)) if (k >= limit) out[k] = v;
  return out;
}

export interface BadgeContext {
  completedLessons: string[];
  puzzleSolved: number;
  puzzleRating: number;
  gamesWon: number;
  gamesPlayed: number;
  streakBest: number;
  xp: number;
  analysedGames: number;
  /** レベルごとのレッスン ID(完了判定用) */
  levelLessons: Record<number, string[]>;
}

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  test: (c: BadgeContext) => boolean;
}

const levelDone = (lv: number) => (c: BadgeContext) => {
  const ids = c.levelLessons[lv] ?? [];
  return ids.length > 0 && ids.every((id) => c.completedLessons.includes(id));
};

export const BADGES: BadgeDef[] = [
  { id: 'first-lesson', name: 'はじめの一歩', desc: 'レッスンを1つ完了', icon: '🌱', test: (c) => c.completedLessons.length >= 1 },
  { id: 'lv1', name: '入門卒業', desc: 'レベル1のレッスンをすべて完了', icon: '🥉', test: levelDone(1) },
  { id: 'lv2', name: '初級卒業', desc: 'レベル2のレッスンをすべて完了', icon: '🥈', test: levelDone(2) },
  { id: 'lv3', name: '中級卒業', desc: 'レベル3のレッスンをすべて完了', icon: '🥇', test: levelDone(3) },
  { id: 'lv4', name: '上級卒業', desc: 'レベル4のレッスンをすべて完了', icon: '🏆', test: levelDone(4) },
  { id: 'puzzle-10', name: 'パズル入門', desc: 'パズルを10問正解', icon: '🧩', test: (c) => c.puzzleSolved >= 10 },
  { id: 'puzzle-100', name: 'パズルマスター', desc: 'パズルを100問正解', icon: '🧠', test: (c) => c.puzzleSolved >= 100 },
  { id: 'rating-1000', name: 'レーティング1000', desc: 'パズルレーティングが1000に到達', icon: '📈', test: (c) => c.puzzleRating >= 1000 },
  { id: 'rating-1400', name: 'レーティング1400', desc: 'パズルレーティングが1400に到達', icon: '🚀', test: (c) => c.puzzleRating >= 1400 },
  { id: 'first-game', name: '初対局', desc: 'CPU対戦を1局終える', icon: '♟', test: (c) => c.gamesPlayed >= 1 },
  { id: 'first-win', name: '初勝利', desc: 'CPUに初めて勝つ', icon: '🎉', test: (c) => c.gamesWon >= 1 },
  { id: 'wins-10', name: '10勝', desc: 'CPUに通算10勝', icon: '⚔️', test: (c) => c.gamesWon >= 10 },
  { id: 'review', name: '振り返り上手', desc: '対局を解析して振り返る', icon: '📊', test: (c) => c.analysedGames >= 1 },
  { id: 'streak-3', name: '3日連続', desc: '3日連続で学習', icon: '🔥', test: (c) => c.streakBest >= 3 },
  { id: 'streak-7', name: '1週間連続', desc: '7日連続で学習', icon: '🔥', test: (c) => c.streakBest >= 7 },
  { id: 'streak-30', name: '30日連続', desc: '30日連続で学習', icon: '☄️', test: (c) => c.streakBest >= 30 },
  { id: 'xp-1000', name: '1000 XP', desc: '累計1000 XPを獲得', icon: '💎', test: (c) => c.xp >= 1000 },
];

/** 新しく獲得したバッジを返す */
export function newBadges(owned: string[], ctx: BadgeContext): BadgeDef[] {
  return BADGES.filter((b) => !owned.includes(b.id) && b.test(ctx));
}

/** XP の獲得量(アクションごとの定義) */
export const XP = {
  lessonFirst: 50,
  lessonRepeat: 5,
  puzzleOk: 10,
  puzzleNg: 2,
  gameWin: 30,
  gameDraw: 15,
  gameLoss: 5,
  review: 10,
} as const;
