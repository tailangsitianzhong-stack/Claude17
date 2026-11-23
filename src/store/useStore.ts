import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { PosEval } from '../features/analysis/logic';
import { LEVELS } from '../content';
import {
  XP,
  dateKey,
  newBadges,
  nextStreak,
  pruneActivity,
  type BadgeContext,
  type Streak,
} from './progress';

export type Screen = 'home' | 'learn' | 'puzzle' | 'play';

export interface SavedGame {
  id: string;
  date: number;
  level: number;
  color: 'w' | 'b';
  result: 'win' | 'draw' | 'loss';
  /** 指し手(UCI)。標準の初期局面から */
  moves: string[];
  /** 解析済みの評価(局面数 = moves.length + 1) */
  analysis?: PosEval[];
}

const MAX_GAMES = 20;

interface GameStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

interface PuzzleStats {
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
}

interface ThemeStat {
  ok: number;
  ng: number;
}

interface PersistedState {
  /** 累計XP・連続学習日数・日別XP・獲得バッジ */
  xp: number;
  streak: Streak;
  activity: Record<string, number>;
  badges: string[];
  /** 画面に出す通知(保存しない) */
  pendingToasts: string[];
  shiftToast: () => void;
  completedLessons: string[];
  puzzleRating: number;
  puzzleStats: PuzzleStats;
  themeStats: Record<string, ThemeStat>;
  seenPuzzles: string[];
  failedPuzzles: string[];
  games: SavedGame[];
  cpuLevel: number;
  coach: boolean;
  stats: GameStats;
  completeLesson: (id: string) => void;
  setCpuLevel: (n: number) => void;
  setCoach: (b: boolean) => void;
  recordGame: (result: 'win' | 'draw' | 'loss') => void;
  addGame: (g: SavedGame) => void;
  setGameAnalysis: (id: string, analysis: PosEval[]) => void;
  deleteGame: (id: string) => void;
  recordPuzzle: (r: { id: string; themes: string[]; ok: boolean; rating: number }) => void;
  resetProgress: () => void;
}

const EMPTY_PUZZLE_STATS: PuzzleStats = { solved: 0, failed: 0, streak: 0, bestStreak: 0 };
const EMPTY_STREAK: Streak = { current: 0, best: 0, last: null };

const LEVEL_LESSONS: Record<number, string[]> = Object.fromEntries(
  LEVELS.map((l) => [l.id, l.lessons.map((x) => x.id)]),
);

function badgeContext(s: PersistedState): BadgeContext {
  return {
    completedLessons: s.completedLessons,
    puzzleSolved: s.puzzleStats.solved,
    puzzleRating: s.puzzleRating,
    gamesWon: s.stats.won,
    gamesPlayed: s.stats.played,
    streakBest: s.streak.best,
    xp: s.xp,
    analysedGames: s.games.filter((g) => g.analysis).length,
    levelLessons: LEVEL_LESSONS,
  };
}

type Data = Omit<PersistedState, 'shiftToast' | 'completeLesson' | 'setCpuLevel' | 'setCoach' | 'recordGame' | 'addGame' | 'setGameAnalysis' | 'deleteGame' | 'recordPuzzle' | 'resetProgress'>;

/**
 * 状態の変更(patch)にXPを加え、連続日数・日別XP・バッジ・通知をまとめて更新した patch を返す。
 * toast を渡すと「+N XP」の通知が出る(バッジ獲得の通知は常に出る)。
 */
function withXp(s: PersistedState, patch: Partial<Data>, amount: number, toast?: string): Partial<PersistedState> {
  const merged: PersistedState = { ...s, ...patch };
  const today = dateKey();
  const xp = merged.xp + amount;
  const streak = nextStreak(merged.streak, today);
  const activity = pruneActivity({ ...merged.activity, [today]: (merged.activity[today] ?? 0) + amount }, today);
  const after: PersistedState = { ...merged, xp, streak, activity };
  const got = newBadges(after.badges, badgeContext(after));
  const toasts = [
    ...(toast ? [`+${amount} XP ${toast}`] : []),
    ...got.map((b) => `${b.icon} バッジ獲得:${b.name}`),
  ];
  return {
    ...patch,
    xp,
    streak,
    activity,
    badges: [...after.badges, ...got.map((b) => b.id)],
    pendingToasts: [...s.pendingToasts, ...toasts],
  };
}

export const useProgress = create<PersistedState>()(
  persist(
    (set) => ({
      xp: 0,
      streak: EMPTY_STREAK,
      activity: {},
      badges: [],
      pendingToasts: [],
      shiftToast: () => set((s) => ({ pendingToasts: s.pendingToasts.slice(1) })),
      completedLessons: [],
      puzzleRating: 800,
      puzzleStats: EMPTY_PUZZLE_STATS,
      themeStats: {},
      seenPuzzles: [],
      failedPuzzles: [],
      games: [],
      cpuLevel: 2,
      coach: true,
      stats: { played: 0, won: 0, drawn: 0, lost: 0 },
      completeLesson: (id) =>
        set((s) =>
          s.completedLessons.includes(id)
            ? withXp(s, {}, XP.lessonRepeat)
            : withXp(s, { completedLessons: [...s.completedLessons, id] }, XP.lessonFirst, 'レッスン完了'),
        ),
      setCpuLevel: (n) => set({ cpuLevel: n }),
      setCoach: (b) => set({ coach: b }),
      recordGame: (result) =>
        set((s) =>
          withXp(
            s,
            {
              stats: {
                played: s.stats.played + 1,
                won: s.stats.won + (result === 'win' ? 1 : 0),
                drawn: s.stats.drawn + (result === 'draw' ? 1 : 0),
                lost: s.stats.lost + (result === 'loss' ? 1 : 0),
              },
            },
            result === 'win' ? XP.gameWin : result === 'draw' ? XP.gameDraw : XP.gameLoss,
            result === 'win' ? '対局に勝利' : '対局完了',
          ),
        ),
      addGame: (g) => set((s) => ({ games: [g, ...s.games.filter((x) => x.id !== g.id)].slice(0, MAX_GAMES) })),
      setGameAnalysis: (id, analysis) =>
        set((s) => {
          const first = !!s.games.find((g) => g.id === id && !g.analysis);
          const games = s.games.map((g) => (g.id === id ? { ...g, analysis } : g));
          return first ? withXp(s, { games }, XP.review, '対局を振り返り') : { games };
        }),
      deleteGame: (id) => set((s) => ({ games: s.games.filter((g) => g.id !== id) })),
      recordPuzzle: ({ id, themes, ok, rating }) =>
        set((s) => {
          const themeStats = { ...s.themeStats };
          for (const t of themes) {
            const cur = themeStats[t] ?? { ok: 0, ng: 0 };
            themeStats[t] = ok ? { ...cur, ok: cur.ok + 1 } : { ...cur, ng: cur.ng + 1 };
          }
          const streak = ok ? s.puzzleStats.streak + 1 : 0;
          const failedSet = new Set(s.failedPuzzles);
          if (ok) failedSet.delete(id);
          else failedSet.add(id);
          return withXp(
            s,
            {
              puzzleRating: rating,
              puzzleStats: {
                solved: s.puzzleStats.solved + (ok ? 1 : 0),
                failed: s.puzzleStats.failed + (ok ? 0 : 1),
                streak,
                bestStreak: Math.max(s.puzzleStats.bestStreak, streak),
              },
              themeStats,
              seenPuzzles: [...s.seenPuzzles.filter((x) => x !== id), id].slice(-400),
              failedPuzzles: [...failedSet].slice(-60),
            },
            ok ? XP.puzzleOk : XP.puzzleNg,
            ok ? 'パズル正解' : undefined,
          );
        }),
      resetProgress: () =>
        set({
          completedLessons: [],
          stats: { played: 0, won: 0, drawn: 0, lost: 0 },
          puzzleRating: 800,
          puzzleStats: EMPTY_PUZZLE_STATS,
          themeStats: {},
          seenPuzzles: [],
          failedPuzzles: [],
          games: [],
          xp: 0,
          streak: EMPTY_STREAK,
          activity: {},
          badges: [],
        }),
    }),
    {
      name: 'chess-dojo-progress',
      // 通知は保存しない
      partialize: (s) => {
        const { pendingToasts: _t, ...rest } = s;
        void _t;
        return rest;
      },
    },
  ),
);

interface UiState {
  screen: Screen;
  lessonId: string | null;
  /** 対局の解析画面で開いている対局 */
  reviewId: string | null;
  setScreen: (s: Screen) => void;
  openLesson: (id: string | null) => void;
  openReview: (id: string | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  screen: 'home',
  lessonId: null,
  reviewId: null,
  setScreen: (screen) => set({ screen, lessonId: null, reviewId: null }),
  openLesson: (lessonId) => set({ screen: 'learn', lessonId, reviewId: null }),
  openReview: (reviewId) => set({ screen: 'play', lessonId: null, reviewId }),
}));
