import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../../components/Board';
import { getLevel } from '../../engine/levels';
import { useProgress, useUi, type SavedGame } from '../../store/useStore';
import { EvalGraph, CLASS_COLOR } from './EvalGraph';
import { analyzeMoves, type CancelToken } from './runAnalysis';
import { CLASS_LABEL, CLASS_SYMBOL, fmtEval, reviewGame, type MoveClass, type MoveReview } from './logic';

const FLAGGED: MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];
const isFlagged = (c: MoveClass) => FLAGGED.includes(c);

function Badge({ cls }: { cls: MoveClass }) {
  if (!isFlagged(cls)) return null;
  return (
    <span className={`badge-cls cls-${cls}`} style={{ background: CLASS_COLOR[cls as 'inaccuracy'] }}>
      {CLASS_SYMBOL[cls]}
    </span>
  );
}

export function AnalysisScreen() {
  const reviewId = useUi((s) => s.reviewId);
  const openReview = useUi((s) => s.openReview);
  const game = useProgress((s) => s.games.find((g) => g.id === reviewId));

  if (!game) {
    return (
      <div className="page">
        <p className="muted">対局が見つかりませんでした。</p>
        <button className="btn" onClick={() => openReview(null)}>
          戻る
        </button>
      </div>
    );
  }
  return <Review key={game.id} game={game} />;
}

function Review({ game }: { game: SavedGame }) {
  const openReview = useUi((s) => s.openReview);
  const setGameAnalysis = useProgress((s) => s.setGameAnalysis);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const token = useRef<CancelToken>({ cancelled: false });
  const [k, setK] = useState(0); // 選択中の局面番号(k 手指した後)
  const [alt, setAlt] = useState(false); // true: 指す前の局面で、指した手とおすすめ手を矢印で表示
  const initialised = useRef(false);

  // 解析がなければ実行
  useEffect(() => {
    token.current = { cancelled: false };
    const t = token.current;
    if (!game.analysis) {
      setFailed(false);
      setProgress({ done: 0, total: game.moves.length + 1 });
      analyzeMoves(game.moves, (done, total) => !t.cancelled && setProgress({ done, total }), t)
        .then((evals) => {
          if (evals && !t.cancelled) setGameAnalysis(game.id, evals);
        })
        .catch(() => !t.cancelled && setFailed(true))
        .finally(() => !t.cancelled && setProgress(null));
    }
    return () => {
      t.cancelled = true;
    };
  }, [game.id, game.analysis, game.moves, setGameAnalysis]);

  const fens = useMemo(() => {
    const c = new Chess();
    const out = [c.fen()];
    for (const u of game.moves) {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: (u[4] || undefined) as 'q' | 'r' | 'b' | 'n' | undefined });
      out.push(c.fen());
    }
    return out;
  }, [game.moves]);

  const review = useMemo(() => (game.analysis ? reviewGame(game.moves, game.analysis) : null), [game]);

  const mine = game.color;
  const myFlagged = useMemo(
    () => (review ? review.moves.filter((m) => m.mover === mine && isFlagged(m.cls)) : []),
    [review, mine],
  );

  // 解析が揃ったら、最初の自分のミスへ移動
  useEffect(() => {
    if (!review || initialised.current) return;
    initialised.current = true;
    if (myFlagged.length) {
      setK(myFlagged[0].ply + 1);
      setAlt(true);
    }
  }, [review, myFlagged]);

  const n = game.moves.length;
  const go = (next: number, withAlt = false) => {
    setK(Math.max(0, Math.min(n, next)));
    setAlt(withAlt);
  };

  const move: MoveReview | null = review && k >= 1 ? review.moves[k - 1] : null;
  const showAlt = alt && !!move;
  const fen = showAlt ? fens[k - 1] : fens[k];
  const lastIdx = showAlt ? k - 2 : k - 1;
  const lastMove =
    lastIdx >= 0 ? { from: game.moves[lastIdx].slice(0, 2), to: game.moves[lastIdx].slice(2, 4) } : null;
  const arrows =
    showAlt && move
      ? [
          { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), color: 'rgba(251,146,60,0.9)' },
          ...(move.bestUci && move.bestUci !== move.uci
            ? [{ from: move.bestUci.slice(0, 2), to: move.bestUci.slice(2, 4), color: 'rgba(34,197,94,0.9)' }]
            : []),
        ]
      : undefined;

  function nextMistake() {
    if (!myFlagged.length) return;
    const nxt = myFlagged.find((m) => m.ply + 1 > k) ?? myFlagged[0];
    go(nxt.ply + 1, true);
  }

  const level = getLevel(game.level);
  const resultText = game.result === 'win' ? '勝ち' : game.result === 'loss' ? '負け' : '引き分け';
  const evalsCp = game.analysis?.map((e) => e.cp);

  const pairs: { n: number; w?: MoveReview; b?: MoveReview }[] = [];
  review?.moves.forEach((m, i) => {
    if (i % 2 === 0) pairs.push({ n: i / 2 + 1, w: m });
    else pairs[pairs.length - 1].b = m;
  });

  const accMine = review ? Math.round(review.accuracy[mine]) : null;
  const accCpu = review ? Math.round(review.accuracy[mine === 'w' ? 'b' : 'w']) : null;
  const countsMine = review?.counts[mine];

  return (
    <div className="play">
      <div className="lesson-head">
        <button className="btn ghost" onClick={() => openReview(null)}>
          ← 戻る
        </button>
        <div className="lesson-title">対局の解析</div>
        <div className="step-count" />
      </div>

      <div className="card review-summary">
        <div className="muted small">
          {resultText}・あなたは{mine === 'w' ? '白' : '黒'}・CPU {level.name}・{game.moves.length}手
        </div>
        {review && accMine !== null && accCpu !== null && countsMine ? (
          <>
            <div className="acc-row">
              <div>
                <div className="acc-num">{accMine}%</div>
                <div className="muted small">あなたの正確度</div>
              </div>
              <div>
                <div className="acc-num dim">{accCpu}%</div>
                <div className="muted small">CPUの正確度</div>
              </div>
            </div>
            <div className="cnt-row">
              {(['inaccuracy', 'mistake', 'blunder'] as const).map((c) => (
                <span key={c} className="cnt">
                  <Badge cls={c} /> {CLASS_LABEL[c]} {countsMine[c]}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="progress-wrap">
            {failed ? (
              <p className="msg bad">解析に失敗しました。もう一度開いてください。</p>
            ) : (
              <>
                <p className="small">各局面をエンジンで解析しています…</p>
                <div className="progress-bar">
                  <div style={{ width: `${progress ? (progress.done / progress.total) * 100 : 0}%` }} />
                </div>
                <p className="muted small">
                  {progress ? `${progress.done}/${progress.total}` : ''}(画面を閉じると中断されます)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <Board
        fen={fen}
        orientation={mine === 'w' ? 'white' : 'black'}
        interactive={false}
        lastMove={lastMove}
        arrows={arrows}
      />

      <div className="controls four">
        <button className="btn" onClick={() => go(0)} disabled={k === 0} aria-label="最初へ">
          ⏮
        </button>
        <button className="btn" onClick={() => go(k - 1)} disabled={k === 0} aria-label="1手戻る">
          ◀
        </button>
        <button className="btn" onClick={() => go(k + 1)} disabled={k === n} aria-label="1手進む">
          ▶
        </button>
        <button className="btn" onClick={() => go(n)} disabled={k === n} aria-label="最後へ">
          ⏭
        </button>
      </div>

      {review && (
        <div className="card detail">
          {move ? (
            <>
              <div className="detail-head">
                <strong>
                  {Math.floor(move.ply / 2) + 1}
                  {move.mover === 'w' ? '. ' : '... '}
                  {move.san}
                  {CLASS_SYMBOL[move.cls]}
                </strong>
                <span className="muted small">
                  {move.mover === mine ? 'あなた' : 'CPU'}・
                  {isFlagged(move.cls) ? <Badge cls={move.cls} /> : null} {CLASS_LABEL[move.cls]}
                </span>
              </div>
              <p className="small muted">
                評価(白から見て) {fmtEval(move.cpBefore)} → {fmtEval(move.cpAfter)}
              </p>
              {move.reason && <p>{move.reason}</p>}
              {isFlagged(move.cls) && move.bestSan && (
                <p>
                  おすすめ手: <strong>{move.bestSan}</strong>
                </p>
              )}
              {!isFlagged(move.cls) && <p className="muted small">{move.cls === 'best' ? 'エンジンも推す手です。' : '悪くない手です。'}</p>}
              {isFlagged(move.cls) && (
                <button className="btn wide" onClick={() => setAlt(!alt)}>
                  {showAlt ? '指した後の局面を見る' : '盤でおすすめ手を見る(橙:指した手/緑:おすすめ)'}
                </button>
              )}
            </>
          ) : (
            <p className="muted">開始局面です。▶ で1手ずつ進められます。</p>
          )}
        </div>
      )}

      {review && myFlagged.length > 0 && (
        <button className="btn primary wide" onClick={nextMistake}>
          ⚠ 次の自分のミスへ({myFlagged.length}か所)
        </button>
      )}
      {review && myFlagged.length === 0 && (
        <p className="msg good">⭕ あなたの手に、不正確な手(?!)以上はありませんでした。</p>
      )}

      {review && evalsCp && (
        <div className="card">
          <div className="detail-head">
            <strong>評価の推移</strong>
            <span className="muted small">
              {k}手後 {fmtEval(evalsCp[k])}
            </span>
          </div>
          <EvalGraph
            evals={evalsCp}
            selected={k}
            marks={review.moves.filter((m) => isFlagged(m.cls)).map((m) => ({ pos: m.ply + 1, cls: m.cls }))}
            onSelect={(p) => go(p)}
          />
          <div className="legend-row muted small">
            <span>上=白が有利 / 下=黒が有利</span>
            <span>◆ 不正確 ▲ ミス ● 大悪手</span>
          </div>
        </div>
      )}

      {review && (
        <div className="card">
          <strong>棋譜(タップで局面へ)</strong>
          <div className="move-table" role="table" aria-label="棋譜と手の評価">
            {pairs.map((p) => (
              <div className="mt-row" role="row" key={p.n}>
                <span className="mt-n">{p.n}.</span>
                {[p.w, p.b].map((m, i) =>
                  m ? (
                    <button
                      key={i}
                      role="cell"
                      className={`mt-cell${k === m.ply + 1 ? ' sel' : ''}`}
                      onClick={() => go(m.ply + 1, isFlagged(m.cls))}
                    >
                      {m.san}
                      <Badge cls={m.cls} />
                    </button>
                  ) : (
                    <span key={i} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
