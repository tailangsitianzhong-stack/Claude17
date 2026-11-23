export interface CpuLevel {
  level: number;
  name: string;
  description: string;
  /** UCI Skill Level (0-20) — UCI_Elo を使わないレベルで利用 */
  skill?: number;
  /** UCI_Elo (1320〜3190) */
  elo?: number;
  /** 探索の深さ制限 */
  depth?: number;
  /** 探索時間(ms) */
  movetime?: number;
}

export const CPU_LEVELS: CpuLevel[] = [
  { level: 1, name: 'レベル1', description: 'ほぼランダム(入門)', skill: 0, depth: 1, movetime: 200 },
  { level: 2, name: 'レベル2', description: 'たまに考える(入門)', skill: 0, depth: 2, movetime: 200 },
  { level: 3, name: 'レベル3', description: 'ミスが多い(初心者)', skill: 2, depth: 3, movetime: 300 },
  { level: 4, name: 'レベル4', description: '一手先は読む(初心者)', skill: 5, depth: 4, movetime: 400 },
  { level: 5, name: 'レベル5', description: 'Elo 約1350(初級)', elo: 1350, movetime: 500 },
  { level: 6, name: 'レベル6', description: 'Elo 約1500(初級〜中級)', elo: 1500, movetime: 600 },
  { level: 7, name: 'レベル7', description: 'Elo 約1700(中級)', elo: 1700, movetime: 800 },
  { level: 8, name: 'レベル8', description: 'Elo 約1900(中上級)', elo: 1900, movetime: 1000 },
  { level: 9, name: 'レベル9', description: 'Elo 約2300(上級)', elo: 2300, movetime: 1200 },
  { level: 10, name: 'レベル10', description: '最強(Stockfish全力)', skill: 20, movetime: 1500 },
];

export function getLevel(level: number): CpuLevel {
  return CPU_LEVELS.find((l) => l.level === level) ?? CPU_LEVELS[0];
}
