import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type MoveInput } from '../../components/Board';
import type { BoardSpec, Lesson, LineStep, MateStep, MoveStep, PracticeStep, QuizStep, Step } from '../../content/types';
import { getEngine } from '../../engine/stockfish';
import type { CpuLevel } from '../../engine/levels';
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [idx, done]);

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
  if (step.type === 'practice') return <PracticeView step={step} onNext={onNext} isLast={isLast} />;
  if (step.type === 'line') return <LineView step={step} onNext={onNext} isLast={isLast} />;
  if (step.type === 'mate') return <MateView step={step} onNext={onNext} isLast={isLast} />;
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

/** 練習用のCPU: 全力だが短時間で返す */
const PRACTICE_CPU: CpuLevel = { level: 0, name: '練習', description: '', skill: 20, movetime: 250 };

type Sq2 = { from: string; to: string };
const sqPair = (uci: string): Sq2 => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
const promoOf = (uci: string) => uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;

function useEngineReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    getEngine()
      .init()
      .then(() => alive.current && setReady(true))
      .catch(() => alive.current && setError(true));
    return () => {
      alive.current = false;
    };
  }, []);
  return { ready, error, alive };
}

function countPieces(fen: string, piece: string): number {
  const board = fen.split(' ')[0];
  return [...board].filter((c) => c === piece).length;
}

function PracticeView({ step, onNext, isLast }: { step: PracticeStep; onNext: () => void; isLast: boolean }) {
  const goal = step.goal ?? 'mate';
  const me = step.userSide ?? new Chess(step.fen).turn();
  const myQueen = me === 'w' ? 'Q' : 'q';
  const myPawn = me === 'w' ? 'P' : 'p';
  const oppQueen = me === 'w' ? 'q' : 'Q';

  const [fen, setFen] = useState(step.fen);
  const [lastMove, setLastMove] = useState<Sq2 | null>(null);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<'play' | 'thinking' | 'won' | 'failed'>('play');
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<Sq2 | null>(null);
  const { ready, error, alive } = useEngineReady();
  const run = useRef(0);
  const started = useRef(false);

  // 相手が先に指す設定のとき、最初の1手を指させる
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (new Chess(step.fen).turn() !== me) void cpuReply(step.fen, 0, ++run.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function reset(msg: string | null = null) {
    const id = ++run.current;
    setFen(step.fen);
    setLastMove(null);
    setMoves(0);
    setHint(null);
    setStatus('play');
    setMessage(msg);
    if (new Chess(step.fen).turn() !== me) void cpuReply(step.fen, 0, id);
  }

  function fail(msg: string) {
    setStatus('failed');
    setMessage(msg);
  }

  /** 相手(CPU)が1手指し、終了条件を判定する */
  async function cpuReply(from: string, count: number, id: number) {
    const chess = new Chess(from);
    setStatus('thinking');
    try {
      const res = await getEngine().playMove(from, PRACTICE_CPU);
      if (id !== run.current || !alive.current) return;
      const mv = res.bestMove;
      chess.move({ ...sqPair(mv), promotion: promoOf(mv) });
      setFen(chess.fen());
      setLastMove(sqPair(mv));
      if (chess.isCheckmate()) return fail('チェックメイトされてしまいました。もう一度挑戦しましょう。');
      if (chess.isDraw()) {
        if (goal === 'survive') return setStatus('won');
        return fail('引き分けになってしまいました。もう一度挑戦しましょう。');
      }
      if (goal === 'survive' && countPieces(chess.fen(), oppQueen) > countPieces(step.fen, oppQueen)) {
        return fail('相手のポーンが昇格してしまいました。もう一度挑戦しましょう。');
      }
      if (goal === 'promote') {
        if (countPieces(chess.fen(), myQueen) > countPieces(step.fen, myQueen)) {
          setStatus('won');
          return;
        }
        if (countPieces(chess.fen(), myPawn) === 0) return fail('ポーンを取られてしまいました。もう一度挑戦しましょう。');
      }
      if (goal === 'survive' && count >= step.maxMoves) {
        // 守り切れたか評価する
        const ev = await getEngine().analyze(chess.fen(), { depth: 14, movetime: 800 });
        if (id !== run.current || !alive.current) return;
        const mine = chess.turn() === me ? ev.cp : -ev.cp;
        if (mine >= -150) setStatus('won');
        else fail('守りきれませんでした。もう一度挑戦しましょう。');
        return;
      }
      setStatus('play');
    } catch {
      if (id === run.current && alive.current) setStatus('play');
    }
  }

  async function handleMove(m: MoveInput) {
    if (status !== 'play') return;
    const chess = new Chess(fen);
    try {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return;
    }
    const count = moves + 1;
    setMoves(count);
    setFen(chess.fen());
    setLastMove({ from: m.from, to: m.to });
    setHint(null);
    setMessage(null);
    if (chess.isCheckmate()) {
      if (goal === 'mate') setStatus('won');
      else fail('チェックメイトですが、今回の目的は別です。もう一度挑戦しましょう。');
      return;
    }
    if (chess.isDraw()) {
      if (goal === 'survive') return setStatus('won');
      if (chess.isStalemate()) return fail('ステイルメイト(引き分け)になってしまいました。相手に動ける手を1つ残しましょう。');
      return fail('引き分けになってしまいました。もう一度挑戦しましょう。');
    }
    if (goal === 'promote' && countPieces(chess.fen(), myQueen) > countPieces(step.fen, myQueen)) {
      // 昇格直後に取られないか、相手の応手を見てから判定
      await cpuReply(chess.fen(), count, ++run.current);
      return;
    }
    if (goal === 'mate' && count >= step.maxMoves) {
      return fail(`${step.maxMoves}手以内に詰ませられませんでした。もう一度挑戦しましょう。`);
    }
    if (goal === 'promote' && count >= step.maxMoves) {
      return fail(`${step.maxMoves}手以内に昇格できませんでした。もう一度挑戦しましょう。`);
    }
    await cpuReply(chess.fen(), count, ++run.current);
  }

  async function showHint() {
    if (status !== 'play') return;
    const id = run.current;
    setStatus('thinking');
    try {
      const res = await getEngine().analyze(fen, { depth: 14, movetime: 800 });
      if (id !== run.current || !alive.current) return;
      setHint(sqPair(res.bestMove));
    } finally {
      if (id === run.current && alive.current) setStatus('play');
    }
  }

  const counterLabel = goal === 'survive' ? '守った手数' : 'あなたの手数';

  return (
    <>
      <Board
        fen={fen}
        orientation={me === 'w' ? 'white' : 'black'}
        interactive={status === 'play' && ready}
        onMove={handleMove}
        lastMove={lastMove}
        arrows={hint ? [hint] : undefined}
      />
      <div className="card">
        <h3>実戦練習</h3>
        <p className="pre">{step.text}</p>
        <p className="muted small">
          {counterLabel}:{moves}/{step.maxMoves}
        </p>
        {!ready && !error && <p className="muted small">エンジンを読み込み中…</p>}
        {error && <p className="msg bad">エンジンを読み込めませんでした。</p>}
        {status === 'thinking' && <p className="muted small">相手が考えています…</p>}
        {message && <p className="msg bad">❌ {message}</p>}
        {status === 'won' && <p className="msg good">⭕ {step.success}</p>}
      </div>
      {status === 'won' ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <div className="controls two">
          <button className="btn" onClick={showHint} disabled={status !== 'play' || !ready}>
            💡 ヒント
          </button>
          <button className="btn" onClick={() => reset()}>
            ↺ やり直し
          </button>
        </div>
      )}
      {status !== 'won' && (
        <button className="btn ghost" onClick={onNext}>
          難しければスキップ ›
        </button>
      )}
    </>
  );
}

/** 決まった手順(定跡・罠)を指して覚える */
function LineView({ step, onNext, isLast }: { step: LineStep; onNext: () => void; isLast: boolean }) {
  const [fen, setFen] = useState(step.fen);
  const [idx, setIdx] = useState(0); // 次に指す手の番号(moves 内)
  const [lastMove, setLastMove] = useState<Sq2 | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [hint, setHint] = useState<Sq2 | null>(null);
  const [shake, setShake] = useState(false);
  const [sans, setSans] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const timers = useRef<number[]>([]);
  const done = idx >= step.moves.length;
  const orientation = step.orientation ?? (new Chess(step.fen).turn() === 'b' ? 'black' : 'white');

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => window.clearTimeout(x));
  }, []);

  function play(chess: Chess, uci: string) {
    const mv = chess.move({ ...sqPair(uci), promotion: promoOf(uci) });
    setFen(chess.fen());
    setLastMove(sqPair(uci));
    setSans((s) => [...s, mv.san]);
  }

  function handleMove(m: MoveInput) {
    if (waiting || done) return;
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
    if (uci !== step.moves[idx]) {
      setShake(true);
      timers.current.push(window.setTimeout(() => setShake(false), 400));
      setWrong('この手順では別の手を指します。ヒントを見てみましょう。');
      return;
    }
    const chess = new Chess(fen);
    play(chess, uci);
    setWrong(null);
    setHint(null);
    setNote(step.notes[Math.floor(idx / 2)] ?? null);
    const next = idx + 1;
    if (next >= step.moves.length) {
      setIdx(next);
      return;
    }
    setWaiting(true);
    timers.current.push(
      window.setTimeout(() => {
        play(chess, step.moves[next]);
        setIdx(next + 1);
        setWaiting(false);
      }, 600),
    );
    setIdx(next);
  }

  const expected = !done && idx % 2 === 0 ? step.moves[idx] : null;

  return (
    <>
      <Board
        fen={fen}
        orientation={orientation}
        interactive={!done && !waiting}
        onMove={handleMove}
        lastMove={lastMove}
        arrows={hint ? [hint] : undefined}
        shake={shake}
      />
      <div className="moves">
        {sans.length === 0 && <span className="muted small">指した手がここに表示されます</span>}
        {sans.map((s, i) => (
          <span key={i} className="pair">
            {s}
          </span>
        ))}
      </div>
      <div className="card">
        <h3>手順を指してみよう</h3>
        <p className="pre">{step.text}</p>
        {note && <p className="msg good">⭕ {note}</p>}
        {wrong && <p className="msg bad">❌ {wrong}</p>}
        {done && <p className="msg good">🎉 {step.success}</p>}
      </div>
      {done ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <button
          className="btn wide"
          disabled={!expected || !!hint}
          onClick={() => expected && setHint(sqPair(expected))}
        >
          💡 ヒントを見る
        </button>
      )}
    </>
  );
}

/** N手詰め。エンジンが「詰みにつながる手か」を判定する */
function MateView({ step, onNext, isLast }: { step: MateStep; onNext: () => void; isLast: boolean }) {
  const [fen, setFen] = useState(step.fen);
  const [remaining, setRemaining] = useState(step.moves);
  const [lastMove, setLastMove] = useState<Sq2 | null>(null);
  const [status, setStatus] = useState<'play' | 'thinking' | 'won'>('play');
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<Sq2 | null>(null);
  const [shake, setShake] = useState(false);
  const { ready, error, alive } = useEngineReady();
  const run = useRef(0);
  const orientation = new Chess(step.fen).turn() === 'b' ? 'black' : 'white';

  function reset() {
    run.current++;
    setFen(step.fen);
    setRemaining(step.moves);
    setLastMove(null);
    setStatus('play');
    setMessage(null);
    setHint(null);
  }

  async function handleMove(m: MoveInput) {
    if (status !== 'play') return;
    const before = fen;
    const chess = new Chess(fen);
    try {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return;
    }
    const id = ++run.current;
    setFen(chess.fen());
    setLastMove({ from: m.from, to: m.to });
    setHint(null);
    setMessage(null);
    if (chess.isCheckmate()) {
      setStatus('won');
      return;
    }
    setStatus('thinking');
    const reject = (msg: string) => {
      setFen(before);
      setLastMove(null);
      setStatus('play');
      setMessage(msg);
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    };
    try {
      if (chess.isDraw()) return reject('それは引き分けになってしまいます。');
      const ev = await getEngine().analyze(chess.fen(), { depth: 16, movetime: 1500 });
      if (id !== run.current || !alive.current) return;
      // 相手側から見て mate が負なら、相手が詰まされる。残り手数以内か確認する
      const ok = ev.mate !== undefined && ev.mate < 0 && -ev.mate <= remaining - 1;
      if (!ok) return reject('その手では、決められた手数で詰ませられません。別の手を探しましょう。');
      const reply = await getEngine().playMove(chess.fen(), PRACTICE_CPU);
      if (id !== run.current || !alive.current) return;
      chess.move({ ...sqPair(reply.bestMove), promotion: promoOf(reply.bestMove) });
      setFen(chess.fen());
      setLastMove(sqPair(reply.bestMove));
      setRemaining(remaining - 1);
      setStatus('play');
    } catch {
      if (id === run.current && alive.current) setStatus('play');
    }
  }

  async function showHint() {
    if (status !== 'play') return;
    const id = run.current;
    setStatus('thinking');
    try {
      const res = await getEngine().analyze(fen, { depth: 16, movetime: 1500 });
      if (id !== run.current || !alive.current) return;
      setHint(sqPair(res.bestMove));
    } finally {
      if (id === run.current && alive.current) setStatus('play');
    }
  }

  return (
    <>
      <Board
        fen={fen}
        orientation={orientation}
        interactive={status === 'play' && ready}
        onMove={handleMove}
        lastMove={lastMove}
        arrows={hint ? [hint] : undefined}
        shake={shake}
      />
      <div className="card">
        <h3>{step.moves}手詰め</h3>
        <p className="pre">{step.text}</p>
        <p className="muted small">あと {remaining} 手で詰ませる</p>
        {!ready && !error && <p className="muted small">エンジンを読み込み中…</p>}
        {error && <p className="msg bad">エンジンを読み込めませんでした。</p>}
        {status === 'thinking' && <p className="muted small">確認中…</p>}
        {message && <p className="msg bad">❌ {message}</p>}
        {status === 'won' && <p className="msg good">⭕ {step.success}</p>}
      </div>
      {status === 'won' ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <div className="controls two">
          <button className="btn" onClick={showHint} disabled={status !== 'play' || !ready}>
            💡 ヒント
          </button>
          <button className="btn" onClick={reset}>
            ↺ やり直し
          </button>
        </div>
      )}
      {status !== 'won' && (
        <button className="btn ghost" onClick={onNext}>
          難しければスキップ ›
        </button>
      )}
    </>
  );
}
