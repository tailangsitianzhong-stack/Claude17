import { useProgress } from '../../store/useStore';
import { BADGES, DAILY_GOAL_XP, daysAgoKey, dateKey, levelProgress, visibleStreak } from '../../store/progress';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 連続日数・ランク・今日の目標・直近7日の記録 */
export function StatusCard() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const activity = useProgress((s) => s.activity);

  const today = dateKey();
  const days = visibleStreak(streak, today);
  const lp = levelProgress(xp);
  const todayXp = activity[today] ?? 0;
  const goalDone = todayXp >= DAILY_GOAL_XP;

  const week = Array.from({ length: 7 }, (_, i) => {
    const key = daysAgoKey(6 - i);
    const [y, m, d] = key.split('-').map(Number);
    return { key, xp: activity[key] ?? 0, label: WEEKDAYS[new Date(y, m - 1, d).getDay()], isToday: key === today };
  });

  return (
    <div className="card status-card">
      <div className="st-top">
        <div className="st-streak" aria-label={`${days}日連続で学習中`}>
          <span className="flame">{days > 0 ? '🔥' : '💤'}</span>
          <span className="st-num">{days}</span>
          <span className="muted small">日連続</span>
        </div>
        <div className="st-level">
          <span className="muted small">ランク</span>
          <span className="st-num">Lv.{lp.level}</span>
        </div>
      </div>

      <div className="st-row">
        <div className="st-label">
          <span>経験値</span>
          <span className="muted small">
            {lp.into}/{lp.need} XP(合計 {xp})
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={lp.into} aria-valuemax={lp.need}>
          <div style={{ width: `${Math.min(100, (lp.into / lp.need) * 100)}%` }} />
        </div>
      </div>

      <div className="st-row">
        <div className="st-label">
          <span>{goalDone ? '✅ 今日の目標を達成!' : '今日の目標'}</span>
          <span className="muted small">
            {Math.min(todayXp, DAILY_GOAL_XP)}/{DAILY_GOAL_XP} XP
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={todayXp} aria-valuemax={DAILY_GOAL_XP}>
          <div style={{ width: `${Math.min(100, (todayXp / DAILY_GOAL_XP) * 100)}%` }} />
        </div>
      </div>

      <div className="week" role="table" aria-label="直近7日間の獲得XP">
        {week.map((d) => (
          <div key={d.key} className={`wk${d.isToday ? ' today' : ''}`} role="cell" aria-label={`${d.label}曜日 ${d.xp} XP`}>
            <div className="wk-bar">
              <div className={d.xp >= DAILY_GOAL_XP ? 'hit' : ''} style={{ height: `${Math.min(100, (d.xp / 60) * 100)}%` }} />
            </div>
            <span className="muted small">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 獲得済み・未獲得のバッジ一覧 */
export function BadgesCard() {
  const owned = useProgress((s) => s.badges);
  return (
    <div className="card">
      <h3>
        バッジ <span className="muted small">{owned.length}/{BADGES.length}</span>
      </h3>
      <div className="badge-grid">
        {BADGES.map((b) => {
          const has = owned.includes(b.id);
          return (
            <div key={b.id} className={`bdg${has ? ' on' : ''}`} title={b.desc}>
              <span className="bdg-icon">{has ? b.icon : '🔒'}</span>
              <span className="bdg-name">{b.name}</span>
              <span className="muted small">{b.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
