import { useProgress, useUi, type Screen } from './store/useStore';
import { LessonList } from './features/lessons/LessonList';
import { LessonPlayer } from './features/lessons/LessonPlayer';
import { PlayScreen } from './features/play/PlayScreen';
import { PuzzleScreen } from './features/puzzles/PuzzleScreen';
import { AnalysisScreen } from './features/analysis/AnalysisScreen';
import { BadgesCard, StatusCard } from './features/home/Dashboard';
import { InstallCard } from './features/home/InstallCard';
import { Toast } from './components/Toast';
import { ALL_LESSONS, findLesson, LEVELS } from './content';

function Home() {
  const completed = useProgress((s) => s.completedLessons);
  const stats = useProgress((s) => s.stats);
  const puzzleRating = useProgress((s) => s.puzzleRating);
  const puzzleStats = useProgress((s) => s.puzzleStats);
  const resetProgress = useProgress((s) => s.resetProgress);
  const { openLesson, setScreen, resumeGame } = useUi();
  const activeGame = useProgress((s) => s.activeGame);
  const nextLesson = ALL_LESSONS.find((l) => !completed.includes(l.id));
  const lv1 = LEVELS[0];
  const lv1Done = lv1.lessons.filter((l) => completed.includes(l.id)).length;

  return (
    <div className="page">
      <h1>♞ チェス道場</h1>
      <p className="muted">初心者から上級者まで。学んで、解いて、対戦しよう。</p>

      <StatusCard />

      {activeGame && activeGame.moves.length > 0 && (
        <div className="card resume-card">
          <h3>▶ 対局の続き</h3>
          <p className="small">
            CPU レベル{activeGame.level}・あなたは{activeGame.color === 'w' ? '白' : '黒'}・{activeGame.moves.length}手まで
          </p>
          <button className="btn primary wide" onClick={resumeGame}>
            対局を再開する
          </button>
        </div>
      )}

      <div className="card hero">
        <h3>つづきから</h3>
        {nextLesson ? (
          <>
            <p>
              次のレッスン:<strong>{nextLesson.title}</strong>
            </p>
            <button className="btn primary wide" onClick={() => openLesson(nextLesson.id)}>
              レッスンを始める
            </button>
          </>
        ) : (
          <p>用意されているレッスンはすべて完了しました!🎉</p>
        )}
        <p className="muted small">
          レベル1の進捗 {lv1Done}/{lv1.lessons.length}
        </p>
        <div className="progress-bar">
          <div style={{ width: `${(lv1Done / lv1.lessons.length) * 100}%` }} />
        </div>
      </div>

      <div className="card">
        <h3>パズル</h3>
        <p className="muted">タダ取り・フォーク・詰みなど、テーマ別の戦術パズル。レーティング付き。</p>
        <button className="btn wide" onClick={() => setScreen('puzzle')}>
          パズルを解く
        </button>
        <p className="muted small">
          パズルレーティング {puzzleRating} ・ {puzzleStats.solved}問正解
        </p>
      </div>

      <div className="card">
        <h3>CPU と対戦</h3>
        <p className="muted">10段階の強さから選べます。コーチ機能・ヒント・待ったつき。</p>
        <button className="btn wide" onClick={() => setScreen('play')}>
          対戦する
        </button>
        <p className="muted small">
          戦績:{stats.played}戦 {stats.won}勝 {stats.drawn}分 {stats.lost}敗
        </p>
      </div>

      <div className="card">
        <h3>ロードマップ</h3>
        <ul className="roadmap">
          {LEVELS.map((l) => (
            <li key={l.id}>
              <strong>{l.name}</strong>
              <small>
                {l.lessons.length > 0 ? `${l.lessons.length}レッスン公開中` : '準備中'} ・ {l.description}
              </small>
            </li>
          ))}
        </ul>
      </div>

      <BadgesCard />

      <InstallCard />

      <button
        className="btn ghost small"
        onClick={() => {
          if (window.confirm('学習の進捗と戦績をすべてリセットしますか?')) resetProgress();
        }}
      >
        進捗をリセット
      </button>
    </div>
  );
}

const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '🏠' },
  { id: 'learn', label: '学ぶ', icon: '📖' },
  { id: 'puzzle', label: 'パズル', icon: '🧩' },
  { id: 'play', label: '対戦', icon: '♟' },
];

export default function App() {
  const { screen, lessonId, reviewId, setScreen } = useUi();
  const lesson = lessonId ? findLesson(lessonId) : undefined;

  return (
    <div className="app">
      <main>
        {screen === 'home' && <Home />}
        {screen === 'learn' &&
          (lesson ? <LessonPlayer key={lesson.id} lesson={lesson} /> : <LessonList />)}
        {screen === 'puzzle' && <PuzzleScreen />}
        {screen === 'play' && (reviewId ? <AnalysisScreen /> : <PlayScreen />)}
      </main>
      <Toast />
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={screen === t.id ? 'active' : ''} onClick={() => setScreen(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
