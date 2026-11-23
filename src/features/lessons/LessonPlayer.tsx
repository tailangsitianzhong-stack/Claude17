import { useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type MoveInput } from '../../components/Board';
import type { BoardSpec, Lesson, MoveStep, QuizStep, Step } from '../../content/types';
import { ALL_LESSONS } from '../../content';
import { useProgress, useUi } from '../../store/useStore';

const HL = 'rgba(250, 204, 21, 0.5)';

function boardProps(b?: BoardSpec) {
  if (!b) return null;
  const highlights: Record<string, string> = {};
  for (const sq of b.highlights ?? []) highlights[sq] = HL;
  return {
    fen: b.fen,
    orientation: b.orientation ?? 'white',
    highlights,
    arrows: (b.arrows ?? []).map(([from, to]) => ({ from, to })),
  };
}

function toUci(m: MoveInput) {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const completeLesson = useProgress((s) => s.completeLesson);
  const openLesson = useUi((s) => s.openLesson);

  const total = lesson.steps.length;
  const step = lesson.steps[idx];

  function next() {
    if (idx + 1 >= total) {
      completeLesson(lesson.id);
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  if (done) {
    const i = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
    const nextLesson = ALL_LESSONS[i + 1];
    return (
      <div className="lesson-done">
        <div className="big-emoji">🎉</div>
        <h2>「{lesson.title}」クリア!</h2>
        <p>お疲れさまでした。</p>
        <div className="stack">
          {nextLesson && (
            <button className="btn primary" onClick={() => openLesson(nextLesson.id)}>
              次のレッスン:{nextLesson.title}
            </button>
          )}
          <button className="btn" onClick={() => openLesson(null)}>
            レッスン一覧へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson">
      <div className="lesson-head">
        <button className="btn ghost" onClick={() => openLesson(null)} aria-label="一覧に戻る">
          ← 一覧
        </button>
        <div className="lesson-title">{lesson.title}</div>
        <div className="step-count">
          {idx + 1}/{total}
        </div>
      </div>
      <div className="progress-bar">
        <div style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <StepView key={`${lesson.id}-${idx}`} step={step} onNext={next} isLast={idx + 1 >= total} />
    </div>
  );
}

function StepView({ step, onNext, isLast }: { step: Step; onNext: () => void; isLast: boolean }) {
  if (step.type === 'explain') return <ExplainView step={step} onNext={onNext} isLast={isLast} />;
  if (step.type === 'quiz') return <QuizView step={step} onNext={onNext} isLast={isLast} />;
  return <MoveView step={step} onNext={onNext} isLast={isLast} />;
}

function NextButton({ onNext, isLast, label }: { onNext: () => void; isLast: boolean; label?: string }) {
  return (
    <button className="btn primary wide" onClick={onNext}>
      {label ?? (isLast ? '完了' : 'つぎへ')}
    </button>
  );
}

function ExplainView({
  step,
  onNext,
  isLast,
}: {
  step: Extract<Step, { type: 'explain' }>;
  onNext: () => void;
  isLast: boolean;
}) {
  const b = boardProps(step.board);
  return (
    <>
      {b && <Board {...b} interactive={false} />}
      <div className="card">
        {step.title && <h3>{step.title}</h3>}
        <p className="pre">{step.text}</p>
      </div>
      <NextButton onNext={onNext} isLast={isLast} />
    </>
  );
}

function QuizView({ step, onNext, isLast }: { step: QuizStep; onNext: () => void; isLast: boolean }) {
  const [picked, setPicked] = useState<number[]>([]);
  const solved = picked.includes(step.answer);
  const b = boardProps(step.board);
  return (
    <>
      {b && <Board {...b} interactive={false} />}
      <div className="card">
        <h3>クイズ</h3>
        <p className="pre">{step.question}</p>
        <div className="choices">
          {step.choices.map((c, i) => {
            const state = picked.includes(i) ? (i === step.answer ? 'right' : 'wrong') : '';
            return (
              <button
                key={i}
                className={`choice ${state}`}
                disabled={solved}
                onClick={() => setPicked((p) => (p.includes(i) ? p : [...p, i]))}
              >
                {c}
              </button>
            );
          })}
        </div>
        {picked.length > 0 && !solved && <p className="msg bad">ざんねん!もう一度考えてみましょう。</p>}
        {solved && <p className="msg good">⭕ 正解!{step.explanation}</p>}
      </div>
      {solved && <NextButton onNext={onNext} isLast={isLast} />}
    </>
  );
}

function MoveView({ step, onNext, isLast }: { step: MoveStep; onNext: () => void; isLast: boolean }) {
  const [fen, setFen] = useState(step.fen);
  const [status, setStatus] = useState<'idle' | 'correct'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [shake, setShake] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  function handleMove(m: MoveInput) {
    const chess = new Chess(step.fen);
    let ok = false;
    let after: Chess | null = null;
    try {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
      after = chess;
    } catch {
      return;
    }
    const uci = toUci(m);
    if (step.answers === 'mate') ok = after.isCheckmate();
    else ok = step.answers.includes(uci);

    if (ok) {
      setFen(after.fen());
      setLastMove({ from: m.from, to: m.to });
      setStatus('correct');
      setShowHint(false);
      setMessage(null);
    } else {
      setWrongCount((c) => c + 1);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      let msg = step.wrong ?? 'おしい!別の手を考えてみましょう。';
      if (after.isStalemate()) msg = 'それはステイルメイト(引き分け)になってしまいます!';
      else if (after.isCheckmate()) msg = 'チェックメイトですが、今回の課題とは違う手です。';
      setMessage(msg);
      if (wrongCount + 1 >= 2) setShowHint(true);
    }
  }

  const hintArrow =
    showHint && step.hint ? [{ from: step.hint.slice(0, 2), to: step.hint.slice(2, 4) }] : undefined;

  return (
    <>
      <Board
        fen={fen}
        orientation={step.orientation ?? (new Chess(step.fen).turn() === 'b' ? 'black' : 'white')}
        interactive={status === 'idle'}
        onMove={handleMove}
        goals={status === 'idle' ? step.goals : undefined}
        arrows={hintArrow}
        lastMove={lastMove}
        shake={shake}
      />
      <div className="card">
        <h3>やってみよう</h3>
        <p className="pre">{step.text}</p>
        {status === 'idle' && message && <p className="msg bad">❌ {message}</p>}
        {status === 'correct' && <p className="msg good">⭕ {step.success}</p>}
      </div>
      {status === 'idle' ? (
        <button
          className="btn wide"
          onClick={() => setShowHint(true)}
          disabled={showHint || !step.hint}
        >
          💡 ヒントを見る
        </button>
      ) : (
        <NextButton onNext={onNext} isLast={isLast} />
      )}
    </>
  );
}
