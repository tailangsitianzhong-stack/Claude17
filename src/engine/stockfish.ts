import type { CpuLevel } from './levels';

export interface EngineEval {
  /** 手番側から見たセンチポーン。詰みは ±(100000 - 手数) 近辺の大きな値に変換 */
  cp: number;
  /** 詰みまでの手数(手番側が詰ます場合は正、詰まされる場合は負)。なければ undefined */
  mate?: number;
  bestMove: string;
  depth: number;
}

interface Job {
  run: () => Promise<void>;
}

/**
 * Stockfish (lite single-thread WASM) を Web Worker で動かす薄いラッパー。
 * コマンドはキューで直列化する。
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private listeners = new Set<(line: string) => void>();
  private queue: Job[] = [];
  private running = false;

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const url = new URL('stockfish/stockfish-18-lite-single.js', document.baseURI).toString();
      let worker: Worker;
      try {
        worker = new Worker(url);
      } catch (e) {
        reject(e);
        return;
      }
      this.worker = worker;
      worker.onmessage = (ev: MessageEvent) => {
        const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
        this.listeners.forEach((l) => l(line));
      };
      worker.onerror = (e) => reject(new Error(e.message || 'engine worker error'));
      const off = this.listen((line) => {
        if (line === 'uciok') {
          this.send('isready');
        } else if (line === 'readyok') {
          off();
          resolve();
        }
      });
      this.send('uci');
    });
    return this.readyPromise;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private listen(fn: (line: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: async () => {
          try {
            resolve(await fn());
          } catch (e) {
            reject(e);
          }
        },
      });
      void this.pump();
    });
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      await job.run();
    }
    this.running = false;
  }

  /** 現在進行中の探索を中断し、キューも破棄する */
  stop() {
    this.queue = [];
    this.send('stop');
  }

  private async search(fen: string, opts: { depth?: number; movetime?: number }): Promise<EngineEval> {
    await this.init();
    return new Promise<EngineEval>((resolve) => {
      let cp = 0;
      let mate: number | undefined;
      let depth = 0;
      const off = this.listen((line) => {
        if (line.startsWith('info') && line.includes(' score ')) {
          const d = /\bdepth (\d+)/.exec(line);
          const m = /\bscore (cp|mate) (-?\d+)/.exec(line);
          if (m && !line.includes('lowerbound') && !line.includes('upperbound')) {
            if (d) depth = Number(d[1]);
            if (m[1] === 'cp') {
              cp = Number(m[2]);
              mate = undefined;
            } else {
              mate = Number(m[2]);
              cp = (mate > 0 ? 100000 - mate : -100000 - mate);
            }
          }
        } else if (line.startsWith('bestmove')) {
          off();
          const best = line.split(' ')[1] ?? '(none)';
          resolve({ cp, mate, bestMove: best, depth });
        }
      });
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      const parts = ['go'];
      if (opts.depth) parts.push('depth', String(opts.depth));
      if (opts.movetime) parts.push('movetime', String(opts.movetime));
      this.send(parts.join(' '));
    });
  }

  /** CPUレベルに応じて最善(に近い)手を指させる */
  playMove(fen: string, level: CpuLevel): Promise<EngineEval> {
    return this.enqueue(async () => {
      await this.init();
      if (level.elo) {
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${level.elo}`);
        this.send('setoption name Skill Level value 20');
      } else {
        this.send('setoption name UCI_LimitStrength value false');
        this.send(`setoption name Skill Level value ${level.skill ?? 20}`);
      }
      return this.search(fen, { depth: level.depth, movetime: level.movetime });
    });
  }

  /** フルパワーで局面を評価する(ヒント・コーチ・解析用) */
  analyze(fen: string, opts: { depth?: number; movetime?: number } = {}): Promise<EngineEval> {
    return this.enqueue(async () => {
      await this.init();
      this.send('setoption name UCI_LimitStrength value false');
      this.send('setoption name Skill Level value 20');
      return this.search(fen, { depth: opts.depth ?? 12, movetime: opts.movetime });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.listeners.clear();
    this.queue = [];
  }
}

let shared: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  if (!shared) shared = new StockfishEngine();
  return shared;
}
