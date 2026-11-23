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

export type Step = ExplainStep | MoveStep | QuizStep;

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
