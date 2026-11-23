import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Screen = 'home' | 'learn' | 'puzzle' | 'play';

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
  completedLessons: string[];
  puzzleRating: number;
  puzzleStats: PuzzleStats;
  themeStats: Record<string, ThemeStat>;
  seenPuzzles: string[];
  failedPuzzles: string[];
  cpuLevel: number;
  coach: boolean;
  stats: GameStats;
  completeLesson: (id: string) => void;
  setCpuLevel: (n: number) => void;
  setCoach: (b: boolean) => void;
  recordGame: (result: 'win' | 'draw' | 'loss') => void;
  recordPuzzle: (r: { id: string; themes: string[]; ok: boolean; rating: number }) => void;
  resetProgress: () => void;
}

const EMPTY_PUZZLE_STATS: PuzzleStats = { solved: 0, failed: 0, streak: 0, bestStreak: 0 };

export const useProgress = create<PersistedState>()(
  persist(
    (set) => ({
      completedLessons: [],
      puzzleRating: 800,
      puzzleStats: EMPTY_PUZZLE_STATS,
      themeStats: {},
      seenPuzzles: [],
      failedPuzzles: [],
      cpuLevel: 2,
      coach: true,
      stats: { played: 0, won: 0, drawn: 0, lost: 0 },
      completeLesson: (id) =>
        set((s) => (s.completedLessons.includes(id) ? s : { completedLessons: [...s.completedLessons, id] })),
      setCpuLevel: (n) => set({ cpuLevel: n }),
      setCoach: (b) => set({ coach: b }),
      recordGame: (result) =>
        set((s) => ({
          stats: {
            played: s.stats.played + 1,
            won: s.stats.won + (result === 'win' ? 1 : 0),
            drawn: s.stats.drawn + (result === 'draw' ? 1 : 0),
            lost: s.stats.lost + (result === 'loss' ? 1 : 0),
          },
        })),
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
          return {
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
          };
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
        }),
    }),
    { name: 'chess-dojo-progress' },
  ),
);

interface UiState {
  screen: Screen;
  lessonId: string | null;
  setScreen: (s: Screen) => void;
  openLesson: (id: string | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  screen: 'home',
  lessonId: null,
  setScreen: (screen) => set({ screen, lessonId: null }),
  openLesson: (lessonId) => set({ screen: 'learn', lessonId }),
}));
