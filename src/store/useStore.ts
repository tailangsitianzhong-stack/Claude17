import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Screen = 'home' | 'learn' | 'play';

interface GameStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

interface PersistedState {
  completedLessons: string[];
  cpuLevel: number;
  coach: boolean;
  stats: GameStats;
  completeLesson: (id: string) => void;
  setCpuLevel: (n: number) => void;
  setCoach: (b: boolean) => void;
  recordGame: (result: 'win' | 'draw' | 'loss') => void;
  resetProgress: () => void;
}

export const useProgress = create<PersistedState>()(
  persist(
    (set) => ({
      completedLessons: [],
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
      resetProgress: () =>
        set({ completedLessons: [], stats: { played: 0, won: 0, drawn: 0, lost: 0 } }),
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
