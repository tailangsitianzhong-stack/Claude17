import type { Level, Lesson } from './types';
import { lv1Lessons } from './lv1';
import { lv2Lessons } from './lv2';

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'レベル1:入門',
    eloRange: '〜600',
    description: '駒の動きとルールを覚えよう',
    lessons: lv1Lessons,
  },
  {
    id: 2,
    name: 'レベル2:初級',
    eloRange: '600〜1000',
    description: 'タダで駒を取られない・取る力をつけよう',
    lessons: lv2Lessons,
  },
  {
    id: 3,
    name: 'レベル3:中級',
    eloRange: '1000〜1500',
    description: '戦術の引き出しと基本戦略',
    lessons: [],
    planned: [
      '主要オープニング(イタリアン/ルイロペス/シシリアン)',
      '二手詰め・三手詰め',
      'ポーン構造',
      'ルークエンドゲーム(ルシェーナ/フィリドール)',
      '守りの技術',
    ],
  },
  {
    id: 4,
    name: 'レベル4:上級',
    eloRange: '1500〜',
    description: '深い計算とポジショナルプレイ',
    lessons: [],
    planned: [
      'ポジショナルプレイ(弱点・アウトポスト・オープンファイル)',
      '高度なエンドゲーム',
      '攻撃の組み立て',
      '計算力トレーニング',
      '名局研究',
    ],
  },
];

export const ALL_LESSONS: Lesson[] = LEVELS.flatMap((l) => l.lessons);

export function findLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}
