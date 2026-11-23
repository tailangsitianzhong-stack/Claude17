import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type MoveInput } from '../../components/Board';
import { useProgress } from '../../store/useStore';
import {
  checkMove,
  loadPuzzles,
  movesOf,
  pickPuzzle,
  startPosition,
  uciToMove,
  updateRating,
  type Puzzle,
} from './logic';
import { PRACTICE_THEMES, themeInfo } from './themes';

type Mode = 'auto' | 'theme' | 'review';
type Phase = 'intro' | 'solving' | 'solved' | 'shown';

export function PuzzleScreen() {
  const { puzzleRating, puzzleStats, themeStats, seenPuzzles, failedPuzzles, recordPuzzle } = useProgress();
  const [all, setAll] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<Mode>('auto');
  const [theme, setTheme] = useState<string | null>(null);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState('');
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [idx, setIdx] = useState(1); // 次に自分が指すべき手の番号
  const [phase, setPhase] = useState<Phase>('intro');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);

  const recorded = useRef(false);
  const token = useRef(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => {
    loadPuzzles()
      .then(setAll)
      .catch(() => setLoadError(true));
    return () => clearTimers();
  }, [clearTimers]);

  const record = useCallback(
    (p: Puzzle, ok: boolean) => {
      if (recorded.current) return;
      recorded.current = true;
      const st = useProgress.getState();
      const games = st.puzzleStats.solved + st.puzzleStats.failed;
      const next = updateRating(st.puzzleRating, p.r, ok, games);
      setDelta(next - st.puzzleRating);
      recordPuzzle({ id: p.i, themes: p.t, ok, rating: next });
    },
    [recordPuzzle],
  );

  const loadNext = useCallback(
    (puzzles: Puzzle[], m: Mode, th: string | null) => {
      clearTimers();
      token.current++;
      const st = useProgress.getState();
      const p = pickPuzzle(puzzles, {
        rating: st.puzzleRating,
        theme: m === 'theme' ? th : null,
        seen: new Set(st.seenPuzzles),
        onlyIds: m === 'review' ? st.failedPuzzles : undefined,
      });
      recorded.current = false;
      setDelta(null);
      setHint(null);
      setMessage(null);
      setLastMove(null);
      if (!p) {
        setPuzzle(null);
        return;
      }
      const start = startPosition(p);
      setPuzzle(p);
      setColor(start.playerColor);
      setIdx(1);
      setPhase('intro');
      setFen(p.f);
      // 相手の最初の1手を少し待ってから指す
      const t = token.current;
      later(() => {
        if (t !== token.current) return;
        setFen(start.fen);
        setLastMove({ from: start.first.slice(0, 2), to: start.first.slice(2, 4) });
        setPhase('solving');
      }, 600);
    },
    [clearTimers, later],
  );

  // 最初の出題
  useEffect(() => {
    if (all && !puzzle) loadNext(all, mode, theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  function changeMode(m: Mode, th: string | null = theme) {
    setMode(m);
    setTheme(th);
    if (all) loadNext(all, m, th);
  }

  function handleMove(m: MoveInput) {
    if (!puzzle || phase !== 'solving') return;
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
    const res = checkMove(puzzle, idx, fen, uci);
    if (!res.ok) {
      setShake(true);
      later(() => setShake(false), 400);
      setMessage('ちがいます。もう一度考えてみましょう。');
      record(puzzle, false);
      return;
    }
    const chess = new Chess(fen);
    chess.move(uciToMove(uci));
    setFen(chess.fen());
    setLastMove({ from: m.from, to: m.to });
    setHint(null);
    setMessage(null);
    const moves = movesOf(puzzle);
    const done = res.altMate || idx + 1 >= moves.length;
    if (done) {
      setPhase('solved');
      record(puzzle, true);
      return;
    }
    // 相手の応手
    const reply = moves[idx + 1];
    const t = token.current;
    setPhase('intro');
    later(() => {
      if (t !== token.current) return;
      const c = new Chess(chess.fen());
      c.move(uciToMove(reply));
      setFen(c.fen());
      setLastMove({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      setIdx(idx + 2);
      setPhase('solving');
    }, 500);
  }

  function showHint() {
    if (!puzzle || phase !== 'solving') return;
    const mv = movesOf(puzzle)[idx];
    setHint({ from: mv.slice(0, 2), to: mv.slice(2, 4) });
    record(puzzle, false);
  }

  function showSolution() {
    if (!puzzle || phase !== 'solving') return;
    record(puzzle, false);
    setPhase('shown');
    setHint(null);
    setMessage(null);
    const moves = movesOf(puzzle);
    const t = token.current;
    let cur = fen;
    let i = idx;
    const step = () => {
      if (t !== token.current || i >= moves.length) return;
      const c = new Chess(cur);
      c.move(uciToMove(moves[i]));
      cur = c.fen();
      setFen(cur);
      setLastMove({ from: moves[i].slice(0, 2), to: moves[i].slice(2, 4) });
      i++;
      later(step, 800);
    };
    step();
  }

  if (loadError) {
    return (
      <div className="page">
        <h1>パズル</h1>
        <p className="msg bad">パズルデータを読み込めませんでした。ページを再読み込みしてください。</p>
      </div>
    );
  }
  if (!all) {
    return (
      <div className="page">
        <h1>パズル</h1>
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  const finished = phase === 'solved' || phase === 'shown';
  const sideText = color === 'w' ? '白' : '黒';

  return (
    <div className="play">
      <div className="puzzle-head">
        <div>
          <small className="muted">パズルレーティング</small>
          <div className="rating">
            {puzzleRating}
            {delta !== null && (
              <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
                {delta >= 0 ? '+' : ''}
                {delta}
              </span>
            )}
          </div>
        </div>
        <div className="streak">
          🔥 {puzzleStats.streak}
          <small className="muted"> 連続</small>
        </div>
      </div>

      <div className="seg">
        <button className={mode === 'auto' ? 'active' : ''} onClick={() => changeMode('auto')}>
          おまかせ
        </button>
        <button className={mode === 'theme' ? 'active' : ''} onClick={() => changeMode('theme', theme ?? 'mateIn1')}>
          テーマ別
        </button>
        <button
          className={mode === 'review' ? 'active' : ''}
          onClick={() => changeMode('review')}
          disabled={failedPuzzles.length === 0}
        >
          復習({failedPuzzles.length})
        </button>
      </div>

      {mode === 'theme' && (
        <div className="theme-row">
          {PRACTICE_THEMES.map((t) => {
            const st = themeStats[t.key];
            return (
              <button
                key={t.key}
                className={`chip theme${theme === t.key ? ' active' : ''}`}
                onClick={() => changeMode('theme', t.key)}
              >
                {t.name}
                {st && (
                  <small>
                    {st.ok}/{st.ok + st.ng}
                  </small>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!puzzle ? (
        <div className="card">
          <p>
            {mode === 'review'
              ? '復習するパズルはありません。🎉'
              : 'このテーマのパズルが見つかりませんでした。'}
          </p>
        </div>
      ) : (
        <>
          <Board
            fen={fen}
            orientation={color === 'w' ? 'white' : 'black'}
            interactive={phase === 'solving'}
            onMove={handleMove}
            lastMove={lastMove}
            arrows={hint ? [hint] : undefined}
            shake={shake}
          />
          <div className={`status${phase === 'solved' ? ' result win' : ''}`}>
            {phase === 'intro' && !finished
              ? '相手が指しています…'
              : phase === 'solved'
                ? '🎉 正解!'
                : phase === 'shown'
                  ? '正解の手順です'
                  : `${sideText}番:最善手を指そう`}
          </div>
          {message && phase === 'solving' && <p className="msg bad">❌ {message}</p>}

          <div className="controls">
            {finished ? (
              <button className="btn primary" style={{ gridColumn: '1 / -1' }} onClick={() => loadNext(all, mode, theme)}>
                次のパズル
              </button>
            ) : (
              <>
                <button className="btn" onClick={showHint} disabled={phase !== 'solving' || !!hint}>
                  💡 ヒント
                </button>
                <button className="btn" onClick={showSolution} disabled={phase !== 'solving'}>
                  👀 答え
                </button>
                <button className="btn" onClick={() => loadNext(all, mode, theme)}>
                  ⏭ スキップ
                </button>
              </>
            )}
          </div>
          {finished && (
            <div className="card">
              <p className="muted small">パズル難易度 {puzzle.r}</p>
              <div className="tags">
                {puzzle.t
                  .filter((k) => !['endgame', 'middlegame', 'opening'].includes(k))
                  .map((k) => {
                    const info = themeInfo(k);
                    return (
                      <div key={k} className="tag">
                        <strong>{info?.name ?? k}</strong>
                        <small>{info?.description}</small>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <p className="muted small center">
            通算 {puzzleStats.solved}問正解 / {puzzleStats.failed}問ミス ・ 出題済み {seenPuzzles.length}問
          </p>
        </>
      )}
    </div>
  );
}
