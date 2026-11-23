import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type MoveInput } from '../../components/Board';
import { getEngine, type EngineEval } from '../../engine/stockfish';
import { CPU_LEVELS, getLevel } from '../../engine/levels';
import { useProgress } from '../../store/useStore';

type Color = 'w' | 'b';
type Busy = null | 'cpu' | 'coach';

interface Blunder {
  san: string;
  lossPawns: number;
  bestSan: string | null;
  bestUci: string | null;
}

interface Result {
  kind: 'win' | 'draw' | 'loss';
  text: string;
}

/** 悪手とみなす評価の落ち幅(センチポーン) */
const BLUNDER_LOSS_CP = 180;

function uciToMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined };
}

function sanOf(fen: string, uci: string | undefined | null): string | null {
  if (!uci || uci === '(none)') return null;
  try {
    return new Chess(fen).move(uciToMove(uci)).san;
  } catch {
    return null;
  }
}

export function PlayScreen() {
  const { cpuLevel, coach, setCpuLevel, setCoach, recordGame, stats } = useProgress();
  const [started, setStarted] = useState(false);
  const [colorChoice, setColorChoice] = useState<'w' | 'b' | 'random'>('w');
  const [player, setPlayer] = useState<Color>('w');
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading');

  const gameRef = useRef(new Chess());
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);
  const gameId = useRef(0);
  const prefetch = useRef<{ fen: string; promise: Promise<EngineEval> } | null>(null);

  const [busy, setBusy] = useState<Busy>(null);
  const [blunder, setBlunder] = useState<Blunder | null>(null);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  const moveListRef = useRef<HTMLDivElement>(null);
  const engine = getEngine();
  const level = getLevel(cpuLevel);

  useEffect(() => {
    let alive = true;
    engine
      .init()
      .then(() => alive && setEngineState('ready'))
      .catch(() => alive && setEngineState('error'));
    return () => {
      alive = false;
    };
  }, [engine]);

  const game = gameRef.current;
  const history = game.history({ verbose: true });
  const lastMove = history.length ? { from: history[history.length - 1].from, to: history[history.length - 1].to } : null;

  useEffect(() => {
    moveListRef.current?.scrollTo({ left: moveListRef.current.scrollWidth });
  }, [history.length]);

  const startPrefetch = useCallback(() => {
    const fen = gameRef.current.fen();
    prefetch.current = { fen, promise: engine.analyze(fen, { depth: 12, movetime: 800 }) };
  }, [engine]);

  const finishIfOver = useCallback(
    (me: Color): boolean => {
      const g = gameRef.current;
      if (!g.isGameOver()) return false;
      let r: Result;
      if (g.isCheckmate()) {
        const loser = g.turn();
        r =
          loser === me
            ? { kind: 'loss', text: 'チェックメイト…あなたの負けです。' }
            : { kind: 'win', text: 'チェックメイト!あなたの勝ちです 🎉' };
      } else if (g.isStalemate()) r = { kind: 'draw', text: 'ステイルメイトで引き分けです。' };
      else if (g.isInsufficientMaterial()) r = { kind: 'draw', text: '駒不足で引き分けです。' };
      else if (g.isThreefoldRepetition()) r = { kind: 'draw', text: '同一局面3回で引き分けです。' };
      else r = { kind: 'draw', text: '50手ルールで引き分けです。' };
      setResult(r);
      recordGame(r.kind);
      return true;
    },
    [recordGame],
  );

  const cpuMove = useCallback(
    async (me: Color, id: number) => {
      setBusy('cpu');
      const g = gameRef.current;
      const started = Date.now();
      try {
        const res = await engine.playMove(g.fen(), level);
        const wait = Math.max(0, 350 - (Date.now() - started));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (id !== gameId.current) return;
        if (res.bestMove && res.bestMove !== '(none)') {
          g.move(uciToMove(res.bestMove));
        }
        rerender();
        if (!finishIfOver(me)) startPrefetch();
      } finally {
        if (id === gameId.current) setBusy(null);
      }
    },
    [engine, level, finishIfOver, startPrefetch],
  );

  function newGame() {
    gameId.current++;
    const me: Color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    gameRef.current = new Chess();
    prefetch.current = null;
    setPlayer(me);
    setResult(null);
    setBlunder(null);
    setHintMove(null);
    setHintsUsed(0);
    setBusy(null);
    setStarted(true);
    rerender();
    if (me === 'b') void cpuMove(me, gameId.current);
    else startPrefetch();
  }

  async function handleUserMove(m: MoveInput) {
    const g = gameRef.current;
    if (busy || result || g.turn() !== player) return;
    const id = gameId.current;
    const beforeFen = g.fen();
    const prev = prefetch.current && prefetch.current.fen === beforeFen ? prefetch.current.promise : null;
    let san: string;
    try {
      san = g.move({ from: m.from, to: m.to, promotion: m.promotion }).san;
    } catch {
      return;
    }
    setHintMove(null);
    rerender();
    if (finishIfOver(player)) return;

    if (coach) {
      setBusy('coach');
      try {
        const before = await (prev ?? engine.analyze(beforeFen, { depth: 12, movetime: 800 }));
        const after = await engine.analyze(g.fen(), { depth: 12, movetime: 800 });
        if (id !== gameId.current) return;
        const userCp = -after.cp; // 自分視点
        const loss = before.cp - userCp;
        const alreadyLost = before.cp < -700;
        if (loss >= BLUNDER_LOSS_CP && !alreadyLost) {
          setBlunder({
            san,
            lossPawns: loss / 100,
            bestSan: sanOf(beforeFen, before.bestMove),
            bestUci: before.bestMove,
          });
          setBusy(null);
          return;
        }
      } catch {
        /* コーチが失敗しても対局は続ける */
      }
      if (id !== gameId.current) return;
    }
    await cpuMove(player, id);
  }

  function undoBlunder() {
    const g = gameRef.current;
    g.undo();
    setBlunder(null);
    setHintMove(null);
    rerender();
    startPrefetch();
  }

  function keepBlunder() {
    setBlunder(null);
    void cpuMove(player, gameId.current);
  }

  function undoMove() {
    if (busy || history.length === 0) return;
    const g = gameRef.current;
    gameId.current++;
    setResult(null);
    g.undo();
    if (g.turn() !== player && g.history().length > 0) g.undo();
    setHintMove(null);
    setBlunder(null);
    rerender();
    if (g.turn() === player) startPrefetch();
    else void cpuMove(player, gameId.current);
  }

  async function showHint() {
    if (busy || result || game.turn() !== player) return;
    setBusy('coach');
    const id = gameId.current;
    try {
      const fen = game.fen();
      const p = prefetch.current && prefetch.current.fen === fen ? prefetch.current.promise : engine.analyze(fen, { depth: 12, movetime: 800 });
      const r = await p;
      if (id !== gameId.current) return;
      if (r.bestMove && r.bestMove !== '(none)') {
        setHintMove({ from: r.bestMove.slice(0, 2), to: r.bestMove.slice(2, 4) });
        setHintsUsed((n) => n + 1);
      }
    } finally {
      if (id === gameId.current) setBusy(null);
    }
  }

  function resign() {
    if (result) return;
    if (!window.confirm('投了しますか?')) return;
    gameId.current++;
    setBusy(null);
    setBlunder(null);
    const r: Result = { kind: 'loss', text: '投了しました。' };
    setResult(r);
    recordGame('loss');
  }

  const movePairs = useMemo(() => {
    const pairs: { n: number; w?: string; b?: string }[] = [];
    history.forEach((mv, i) => {
      if (i % 2 === 0) pairs.push({ n: i / 2 + 1, w: mv.san });
      else pairs[pairs.length - 1].b = mv.san;
    });
    return pairs;
  }, [history]);

  if (!started) {
    return (
      <div className="page">
        <h1>CPU と対戦</h1>
        {engineState === 'loading' && <p className="muted small">エンジンを読み込み中…</p>}
        {engineState === 'error' && (
          <p className="msg bad">エンジンを読み込めませんでした。ページを再読み込みしてください。</p>
        )}
        <div className="card">
          <h3>CPUの強さ</h3>
          <div className="level-grid">
            {CPU_LEVELS.map((l) => (
              <button
                key={l.level}
                className={`chip${l.level === cpuLevel ? ' active' : ''}`}
                onClick={() => setCpuLevel(l.level)}
              >
                {l.level}
              </button>
            ))}
          </div>
          <p className="muted">
            <strong>{level.name}</strong>:{level.description}
          </p>
        </div>
        <div className="card">
          <h3>あなたの色</h3>
          <div className="seg">
            {(
              [
                ['w', '白(先手)'],
                ['b', '黒(後手)'],
                ['random', 'ランダム'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={colorChoice === v ? 'active' : ''} onClick={() => setColorChoice(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <label className="toggle">
            <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
            <span>
              <strong>コーチモード</strong>
              <small>悪手を指すと警告して、取り消すか選べます</small>
            </span>
          </label>
        </div>
        <button className="btn primary wide" disabled={engineState !== 'ready'} onClick={newGame}>
          {engineState === 'ready' ? '対局開始' : '読み込み中…'}
        </button>
        <p className="muted small center">
          戦績:{stats.played}戦 {stats.won}勝 {stats.drawn}分 {stats.lost}敗
        </p>
      </div>
    );
  }

  const myTurn = game.turn() === player && !result;
  const status = result
    ? result.text
    : busy === 'cpu'
      ? 'CPUが考えています…'
      : busy === 'coach'
        ? 'コーチが確認中…'
        : myTurn
          ? game.isCheck()
            ? 'あなたの番(王手されています!)'
            : 'あなたの番'
          : 'CPUの番';

  return (
    <div className="play">
      <div className="play-head">
        <span className="who">
          ⚙️ CPU {level.name} <small>({level.description})</small>
        </span>
      </div>
      <Board
        fen={game.fen()}
        orientation={player === 'w' ? 'white' : 'black'}
        interactive={myTurn && !busy && !blunder}
        onMove={handleUserMove}
        lastMove={lastMove}
        arrows={
          hintMove
            ? [{ from: hintMove.from, to: hintMove.to }]
            : blunder?.bestUci
              ? [{ from: blunder.bestUci.slice(0, 2), to: blunder.bestUci.slice(2, 4) }]
              : undefined
        }
      />
      <div className={`status${result ? ` result ${result.kind}` : ''}`}>{status}</div>

      <div className="moves" ref={moveListRef}>
        {movePairs.length === 0 && <span className="muted small">棋譜がここに表示されます</span>}
        {movePairs.map((p) => (
          <span key={p.n} className="pair">
            <em>{p.n}.</em> {p.w} {p.b}
          </span>
        ))}
      </div>

      {blunder && (
        <div className="modal-back">
          <div className="modal">
            <h3>🤔 ちょっと待って!</h3>
            {blunder.lossPawns >= 20 ? (
              <p>
                <strong>{blunder.san}</strong> は、大きく不利になる(駒を大量に失う・詰まされる)手かもしれません。
              </p>
            ) : (
              <p>
                <strong>{blunder.san}</strong> は、評価が約 <strong>{blunder.lossPawns.toFixed(1)}</strong>{' '}
                ポーン分悪くなる手かもしれません。
              </p>
            )}
            {blunder.bestSan && (
              <p>
                エンジンのおすすめは <strong>{blunder.bestSan}</strong>(盤上の矢印)です。
              </p>
            )}
            <div className="stack">
              <button className="btn primary" onClick={undoBlunder}>
                取り消して考え直す
              </button>
              <button className="btn" onClick={keepBlunder}>
                そのまま指す
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="controls">
        <button className="btn" onClick={showHint} disabled={!myTurn || !!busy || !!blunder}>
          💡 ヒント{hintsUsed ? `(${hintsUsed})` : ''}
        </button>
        <button className="btn" onClick={undoMove} disabled={!!busy || history.length === 0 || !!blunder}>
          ↩ 待った
        </button>
        {result ? (
          <button className="btn primary" onClick={() => setStarted(false)}>
            もう一局
          </button>
        ) : (
          <button className="btn danger" onClick={resign} disabled={!!blunder}>
            🏳 投了
          </button>
        )}
      </div>
      {result && (
        <p className="muted small center">
          評価:コーチ{coach ? 'あり' : 'なし'}・ヒント{hintsUsed}回
        </p>
      )}
    </div>
  );
}
