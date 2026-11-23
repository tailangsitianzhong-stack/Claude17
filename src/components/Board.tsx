import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export interface MoveInput {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface BoardArrow {
  from: string;
  to: string;
  color?: string;
}

interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** false の間は操作不可 */
  interactive?: boolean;
  /** 指し手を受け取る。合法手のときだけ呼ばれる */
  onMove?: (move: MoveInput) => void;
  lastMove?: { from: string; to: string } | null;
  /** マス → 色 のハイライト */
  highlights?: Record<string, string>;
  /** ゴール(目標)マスに星印をつける */
  goals?: string[];
  arrows?: BoardArrow[];
  shake?: boolean;
}

const SELECT_COLOR = 'rgba(250, 204, 21, 0.65)';
const LAST_COLOR = 'rgba(250, 204, 21, 0.35)';
const CHECK_COLOR = 'rgba(239, 68, 68, 0.7)';

function safeChess(fen: string): Chess {
  try {
    return new Chess(fen, { skipValidation: true });
  } catch {
    return new Chess();
  }
}

export function Board({
  fen,
  orientation = 'white',
  interactive = true,
  onMove,
  lastMove,
  highlights,
  goals,
  arrows,
  shake,
}: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);

  // 局面が変わったら選択を解除
  useEffect(() => {
    setSelected(null);
    setPending(null);
  }, [fen]);

  const chess = useMemo(() => safeChess(fen), [fen]);

  const targets = useMemo(() => {
    if (!selected || !interactive) return [] as string[];
    try {
      return chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [chess, selected, interactive]);

  function isPromotion(from: string, to: string): boolean {
    const piece = chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
  }

  function tryMove(from: string, to: string): boolean {
    if (!interactive) return false;
    const legal = chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to);
    if (!legal) return false;
    if (isPromotion(from, to)) {
      setPending({ from, to });
      setSelected(null);
      return true;
    }
    setSelected(null);
    onMove?.({ from, to });
    return true;
  }

  function handleSquareClick(square: string, hasPiece: boolean) {
    if (!interactive) return;
    if (selected && selected !== square && tryMove(selected, square)) return;
    const piece = chess.get(square as Square);
    if (hasPiece && piece && piece.color === chess.turn()) {
      setSelected(selected === square ? null : square);
    } else {
      setSelected(null);
    }
  }

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { background: LAST_COLOR };
      s[lastMove.to] = { background: LAST_COLOR };
    }
    if (highlights) {
      for (const [sq, color] of Object.entries(highlights)) s[sq] = { background: color };
    }
    try {
      if (chess.isCheck()) {
        const turn = chess.turn();
        for (const row of chess.board()) {
          for (const cell of row) {
            if (cell && cell.type === 'k' && cell.color === turn) {
              s[cell.square] = { background: `radial-gradient(circle, ${CHECK_COLOR} 30%, transparent 75%)` };
            }
          }
        }
      }
    } catch {
      /* skipValidation 局面では無視 */
    }
    if (selected) s[selected] = { background: SELECT_COLOR };
    for (const t of targets) {
      const occupied = !!chess.get(t as Square);
      const dot = occupied
        ? 'radial-gradient(circle, transparent 55%, rgba(20,20,20,0.35) 58%, rgba(20,20,20,0.35) 70%, transparent 73%)'
        : 'radial-gradient(circle, rgba(20,20,20,0.3) 22%, transparent 25%)';
      s[t] = { ...(s[t] ?? {}), background: dot };
    }
    if (goals) {
      for (const g of goals) {
        const star = 'radial-gradient(circle, rgba(34,197,94,0.75) 30%, rgba(34,197,94,0.25) 34%, transparent 62%)';
        s[g] = { ...(s[g] ?? {}), background: star };
      }
    }
    return s;
  }, [chess, selected, targets, lastMove, highlights, goals]);

  const arrowList = (arrows ?? []).map((a) => ({
    startSquare: a.from,
    endSquare: a.to,
    color: a.color ?? 'rgba(34,197,94,0.85)',
  }));

  return (
    <div className={`board-wrap${shake ? ' shake' : ''}`}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          allowDrawingArrows: false,
          showAnimations: true,
          animationDurationInMs: 180,
          squareStyles,
          arrows: arrowList,
          lightSquareStyle: { backgroundColor: '#f0d9b5' },
          darkSquareStyle: { backgroundColor: '#b58863' },
          canDragPiece: ({ piece }) => {
            if (!interactive) return false;
            const color = piece.pieceType[0] === 'w' ? 'w' : 'b';
            return color === chess.turn();
          },
          onSquareClick: ({ piece, square }) => handleSquareClick(square, !!piece),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return tryMove(sourceSquare, targetSquare);
          },
        }}
      />
      {pending && (
        <div className="promo-overlay" onClick={() => setPending(null)}>
          <div className="promo-box" onClick={(e) => e.stopPropagation()}>
            <p>何に成りますか?</p>
            <div className="promo-choices">
              {(
                [
                  ['q', 'クイーン', '♛'],
                  ['r', 'ルーク', '♜'],
                  ['b', 'ビショップ', '♝'],
                  ['n', 'ナイト', '♞'],
                ] as const
              ).map(([p, label, glyph]) => (
                <button
                  key={p}
                  onClick={() => {
                    const mv = pending;
                    setPending(null);
                    onMove?.({ from: mv.from, to: mv.to, promotion: p });
                  }}
                >
                  <span className="glyph">{glyph}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
