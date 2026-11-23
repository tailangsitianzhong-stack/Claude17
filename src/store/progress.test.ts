import { describe, expect, it } from 'vitest';
import {
  BADGES,
  dateKey,
  levelFromXp,
  levelProgress,
  newBadges,
  nextStreak,
  pruneActivity,
  visibleStreak,
  xpForLevel,
  type BadgeContext,
} from './progress';

describe('streak', () => {
  it('starts at 1 and increments on consecutive days', () => {
    let s = nextStreak({ current: 0, best: 0, last: null }, '2026-11-20');
    expect(s).toEqual({ current: 1, best: 1, last: '2026-11-20' });
    s = nextStreak(s, '2026-11-21');
    expect(s.current).toBe(2);
    s = nextStreak(s, '2026-11-21'); // 同じ日は変わらない
    expect(s.current).toBe(2);
  });

  it('resets after a gap but keeps best', () => {
    const s = nextStreak({ current: 5, best: 5, last: '2026-11-10' }, '2026-11-13');
    expect(s).toEqual({ current: 1, best: 5, last: '2026-11-13' });
  });

  it('handles month and year boundaries', () => {
    expect(nextStreak({ current: 2, best: 2, last: '2026-11-30' }, '2026-12-01').current).toBe(3);
    expect(nextStreak({ current: 2, best: 2, last: '2026-12-31' }, '2027-01-01').current).toBe(3);
  });

  it('visibleStreak drops to 0 when the last day is before yesterday', () => {
    const s = { current: 4, best: 4, last: '2026-11-20' };
    expect(visibleStreak(s, '2026-11-20')).toBe(4);
    expect(visibleStreak(s, '2026-11-21')).toBe(4);
    expect(visibleStreak(s, '2026-11-22')).toBe(0);
    expect(visibleStreak({ current: 0, best: 0, last: null }, '2026-11-22')).toBe(0);
  });
});

describe('levels', () => {
  it('computes level boundaries', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(39)).toBe(1);
    expect(levelFromXp(40)).toBe(2);
    expect(levelFromXp(160)).toBe(3);
    expect(xpForLevel(3)).toBe(160);
  });

  it('reports progress within a level', () => {
    expect(levelProgress(100)).toEqual({ level: 2, into: 60, need: 120 });
  });
});

describe('activity & badges', () => {
  it('prunes old activity', () => {
    const out = pruneActivity({ '2026-01-01': 10, '2026-11-20': 30 }, '2026-11-23');
    expect(Object.keys(out)).toEqual(['2026-11-20']);
  });

  it('dateKey is zero padded', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  const base: BadgeContext = {
    completedLessons: [],
    puzzleSolved: 0,
    puzzleRating: 800,
    gamesWon: 0,
    gamesPlayed: 0,
    streakBest: 0,
    xp: 0,
    analysedGames: 0,
    levelLessons: { 1: ['a', 'b'], 2: ['c'] },
  };

  it('awards each badge only once and by its condition', () => {
    expect(newBadges([], base)).toEqual([]);
    const ctx = { ...base, completedLessons: ['a'], gamesPlayed: 1, gamesWon: 1 };
    const ids = newBadges([], ctx).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['first-lesson', 'first-game', 'first-win']));
    expect(ids).not.toContain('lv1');
    expect(newBadges(['first-lesson'], ctx).map((b) => b.id)).not.toContain('first-lesson');
    const done = newBadges([], { ...base, completedLessons: ['a', 'b'] }).map((b) => b.id);
    expect(done).toContain('lv1');
  });

  it('badge ids are unique', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
