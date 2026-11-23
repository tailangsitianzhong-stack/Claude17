import { LEVELS } from '../../content';
import { useProgress, useUi } from '../../store/useStore';

export function LessonList() {
  const completed = useProgress((s) => s.completedLessons);
  const openLesson = useUi((s) => s.openLesson);

  return (
    <div className="page">
      <h1>学ぶ</h1>
      {LEVELS.map((level) => {
        const done = level.lessons.filter((l) => completed.includes(l.id)).length;
        return (
          <section key={level.id} className="level">
            <div className="level-head">
              <h2>{level.name}</h2>
              <span className="badge">目安 Elo {level.eloRange}</span>
            </div>
            <p className="muted">{level.description}</p>
            {level.lessons.length > 0 && (
              <p className="muted small">
                進捗 {done}/{level.lessons.length}
              </p>
            )}
            <div className="lesson-items">
              {level.lessons.map((lesson, i) => {
                const isDone = completed.includes(lesson.id);
                return (
                  <button key={lesson.id} className={`lesson-item${isDone ? ' done' : ''}`} onClick={() => openLesson(lesson.id)}>
                    <span className="num">{isDone ? '✓' : i + 1}</span>
                    <span className="lesson-text">
                      <strong>{lesson.title}</strong>
                      <small>{lesson.summary}</small>
                    </span>
                    <span className="chev">›</span>
                  </button>
                );
              })}
              {level.planned?.map((name) => (
                <div key={name} className="lesson-item planned">
                  <span className="num">🔒</span>
                  <span className="lesson-text">
                    <strong>{name}</strong>
                    <small>準備中</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
