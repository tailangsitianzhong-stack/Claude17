/**
 * レッスンの「正解手」が本当に最善手かを Stockfish で確認する(任意実行)。
 *   VERIFY_ENGINE=1 npx vitest run src/content/engine-verify.test.ts
 * 正解にしていないのに最善手と同等の手がある場合は警告として表示する。
 */
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { ALL_LESSONS } from './index';

const ENGINE = 'node_modules/stockfish/bin/stockfish-18-lite-single.js';

class Uci {
  private proc = spawn('node', [ENGINE]);
  private buf = '';
  private waiter: ((line: string) => boolean) | null = null;
  private resolve: (() => void) | null = null;
  constructor() {
    this.proc.stdout.on("data", (d: Buffer) => {
      this.buf += d.toString();
      const lines = this.buf.split('\n');
      this.buf = lines.pop() ?? '';
      for (const l of lines) {
        if (this.waiter && this.waiter(l.trim())) {
          this.waiter = null;
          this.resolve?.();
        }
      }
    });
  }
  send(c: string) {
    this.proc.stdin.write(c + '\n');
  }
  until(pred: (line: string) => boolean): Promise<void> {
    return new Promise((res) => {
      this.waiter = pred;
      this.resolve = res;
    });
  }
  close() {
    this.proc.kill();
  }
}

/** 手番側から見た評価(cp)。詰みは大きな値に変換 */
async function evalMoves(u: Uci, fen: string, searchmoves?: string[]): Promise<{ cp: number; best: string }> {
  let cp = 0;
  let best = '';
  const done = u.until((l) => {
    if (l.startsWith('info') && l.includes(' score ') && !l.includes('bound')) {
      const m = /score (cp|mate) (-?\d+)/.exec(l);
      if (m) cp = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 100000 : -100000) - Number(m[2]);
    }
    if (l.startsWith('bestmove')) {
      best = l.split(' ')[1];
      return true;
    }
    return false;
  });
  u.send(`position fen ${fen}`);
  u.send(`go depth 16${searchmoves ? ' searchmoves ' + searchmoves.join(' ') : ''}`);
  await done;
  return { cp, best };
}

describe.skipIf(!process.env.VERIFY_ENGINE)('engine verification of lesson answers', () => {
  it('answers are (near-)best moves', async () => {
    const u = new Uci();
    u.send('uci');
    await u.until((l) => l === 'uciok');
    u.send('isready');
    await u.until((l) => l === 'readyok');
    const problems: string[] = [];
    const notes: string[] = [];
    for (const lesson of ALL_LESSONS.filter((l) => l.id.startsWith(process.env.VERIFY_PREFIX ?? 'lv2'))) {
      for (const [i, step] of lesson.steps.entries()) {
        if (step.type !== 'move' || step.answers === 'mate') continue;
        const tag = `${lesson.id}#${i}`;
        const top = await evalMoves(u, step.fen);
        const legal = new Chess(step.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
        for (const a of step.answers) {
          const r = await evalMoves(u, step.fen, [a]);
          if (r.cp < top.cp - 120) problems.push(`${tag}: answer ${a} cp=${r.cp} vs best ${top.best} cp=${top.cp}`);
        }
        // 正解にしていない手で、最善手と同等のものがあるか(上位だけ確認)
        if (!step.answers.includes(top.best)) notes.push(`${tag}: engine best ${top.best} (cp ${top.cp}) not in answers`);
        void legal;
      }
    }
    u.close();
    console.log('PROBLEMS:\n' + (problems.join('\n') || 'none'));
    console.log('NOTES:\n' + (notes.join('\n') || 'none'));
    expect(problems).toEqual([]);
  }, 600000);

  it('practice positions are mated by best play within maxMoves', async () => {
    const u = new Uci();
    u.send('uci');
    await u.until((l) => l === 'uciok');
    u.send('isready');
    await u.until((l) => l === 'readyok');
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.type !== 'practice') continue;
        const chess = new Chess(step.fen);
        const me = chess.turn();
        let mine = 0;
        while (!chess.isGameOver() && mine <= step.maxMoves) {
          const r = await evalMoves(u, chess.fen());
          if (chess.turn() === me) mine++;
          chess.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] });
        }
        console.log(`${lesson.id}: mate=${chess.isCheckmate()} myMoves=${mine} (max ${step.maxMoves})`);
        expect(chess.isCheckmate()).toBe(true);
        expect(mine).toBeLessThanOrEqual(step.maxMoves);
      }
    }
    u.close();
  }, 600000);
});
