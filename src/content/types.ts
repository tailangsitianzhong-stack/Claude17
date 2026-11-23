export interface BoardSpec {
  fen: string;
  orientation?: 'white' | 'black';
  /** 矢印 [from, to] */
  arrows?: [string, string][];
  /** 強調表示するマス */
  highlights?: string[];
}

export interface ExplainStep {
  type: 'explain';
  title?: string;
  text: string;
  board?: BoardSpec;
}

/** 盤上で実際に指してもらうステップ */
export interface MoveStep {
  type: 'move';
  text: string;
  fen: string;
  orientation?: 'white' | 'black';
  /** 正解の手(UCI形式 例: 'e2e4', 'a7a8q')。'mate' なら「チェックメイトになる手なら何でも正解」 */
  answers: string[] | 'mate';
  /** 目標マス(緑の印で表示) */
  goals?: string[];
  /** ヒントとして出す矢印 */
  hint?: string;
  success: string;
  wrong?: string;
}

export interface QuizStep {
  type: 'quiz';
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  board?: BoardSpec;
}

/**
 * CPU(Stockfish)を相手に、最後まで指す練習。
 * goal: 'mate' = チェックメイトを目指す(デフォルト) / 'promote' = ポーンを昇格させて勝つ /
 *       'survive' = maxMoves 手まで守り切る(評価が大きく悪化しなければ成功)
 */
export interface PracticeStep {
  type: 'practice';
  text: string;
  fen: string;
  /** 自分が指せる最大手数(超えたらやり直し/守り切り成功の判定) */
  maxMoves: number;
  success: string;
  goal?: 'mate' | 'promote' | 'survive';
  /** 自分の側(省略時は FEN の手番側)。相手が先に指す場合に指定 */
  userSide?: 'w' | 'b';
}

/**
 * 決まった手順(定跡・罠)を実際に指して覚えるステップ。
 * moves は UCI で、自分→相手→自分… の順(自分が先に指す)。notes[i] は自分の i 手目の解説。
 */
export interface LineStep {
  type: 'line';
  text: string;
  fen: string;
  orientation?: 'white' | 'black';
  moves: string[];
  notes: string[];
  success: string;
}

/** N手で詰ませる問題。エンジンが「詰みにつながる手か」を判定する */
export interface MateStep {
  type: 'mate';
  text: string;
  fen: string;
  /** 何手で詰ませるか(2 = 二手詰め) */
  moves: number;
  success: string;
}

export type Step = ExplainStep | MoveStep | QuizStep | PracticeStep | LineStep | MateStep;

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: Step[];
}

export interface Level {
  id: number;
  name: string;
  eloRange: string;
  description: string;
  lessons: Lesson[];
  /** 未実装(準備中)のレッスン名 */
  planned?: string[];
}
