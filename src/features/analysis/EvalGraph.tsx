import { useRef } from 'react';
import { winPct, type MoveClass } from './logic';

const W = 320;
const H = 120;
const PAD_X = 8;
const PAD_Y = 8;

/** ステータス色(重大度の順。記号・ラベルとセットで使う) */
export const CLASS_COLOR: Record<'inaccuracy' | 'mistake' | 'blunder', string> = {
  inaccuracy: '#fab219',
  mistake: '#ec835a',
  blunder: '#d03b3b',
};

interface Mark {
  /** マーカーを置く局面番号(悪手を指した直後の局面) */
  pos: number;
  cls: MoveClass;
}

interface Props {
  /** 各局面の白から見た評価(cp)。長さ = 手数 + 1 */
  evals: number[];
  selected: number;
  marks: Mark[];
  onSelect: (pos: number) => void;
}

/** 評価推移のエリアチャート。白の優勢(上)・黒の優勢(下)を勝率で表示する。タップ/ドラッグで局面を選べる */
export function EvalGraph({ evals, selected, marks, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const n = Math.max(1, evals.length - 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const xOf = (k: number) => PAD_X + (k / n) * innerW;
  const yOf = (cp: number) => PAD_Y + ((100 - winPct(cp)) / 100) * innerH;

  const pts = evals.map((cp, k) => `${xOf(k).toFixed(1)},${yOf(cp).toFixed(1)}`);
  const area = `${xOf(0).toFixed(1)},${H - PAD_Y} ${pts.join(' ')} ${xOf(evals.length - 1).toFixed(1)},${H - PAD_Y}`;
  const mid = PAD_Y + innerH / 2;

  function pick(clientX: number) {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const k = Math.round(((x - PAD_X) / innerW) * n);
    onSelect(Math.max(0, Math.min(evals.length - 1, k)));
  }

  const sel = Math.max(0, Math.min(evals.length - 1, selected));

  return (
    <svg
      ref={svgRef}
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="評価の推移グラフ。上が白の優勢、下が黒の優勢。タップで局面を選べます。"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && pick(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <rect x="0" y="0" width={W} height={H} className="eg-bg" rx="8" />
      {/* 白の優勢分(線より下)を明るい面で塗る */}
      <polygon points={area} className="eg-area" />
      <line x1={PAD_X} x2={W - PAD_X} y1={mid} y2={mid} className="eg-mid" />
      <polyline points={pts.join(' ')} className="eg-line" />
      <line x1={xOf(sel)} x2={xOf(sel)} y1={PAD_Y - 4} y2={H - PAD_Y + 4} className="eg-cursor" />
      <circle cx={xOf(sel)} cy={yOf(evals[sel])} r="4" className="eg-dot" />
      {marks.map((m) => {
        if (m.cls === 'best' || m.cls === 'good') return null;
        const x = xOf(m.pos);
        const y = yOf(evals[m.pos]);
        const color = CLASS_COLOR[m.cls];
        // 形でも区別する: 不正確=ひし形、ミス=三角、大悪手=円
        const shape =
          m.cls === 'inaccuracy' ? (
            <polygon points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`} />
          ) : m.cls === 'mistake' ? (
            <polygon points={`${x},${y - 5.5} ${x + 5.5},${y + 4.5} ${x - 5.5},${y + 4.5}`} />
          ) : (
            <circle cx={x} cy={y} r="5" />
          );
        return (
          <g key={`${m.pos}-${m.cls}`} fill={color} className="eg-mark">
            {shape}
          </g>
        );
      })}
    </svg>
  );
}
