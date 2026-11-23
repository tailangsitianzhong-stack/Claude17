export interface ThemeInfo {
  key: string;
  name: string;
  description: string;
}

export const THEME_LIST: ThemeInfo[] = [
  { key: 'mateIn1', name: '一手詰め', description: '1手でチェックメイトにできます。' },
  { key: 'mateIn2', name: '二手詰め', description: '2手でチェックメイトにできます。相手の返事も読みましょう。' },
  { key: 'mateIn3', name: '三手詰め', description: '3手でチェックメイトにできます。' },
  { key: 'backRankMate', name: 'バックランクメイト', description: '自陣の一番奥の段でキングが閉じ込められているところを、ルークやクイーンで詰ます形。' },
  { key: 'smotheredMate', name: 'スマザーメイト', description: '自分の駒で逃げ道をふさがれたキングを、ナイトで詰ます形。' },
  { key: 'fork', name: 'フォーク', description: '1つの駒で同時に2つ以上の駒を攻撃します。' },
  { key: 'pin', name: 'ピン', description: '動くと後ろの大事な駒が取られるため、動けなくなっている駒を狙います。' },
  { key: 'skewer', name: 'スキュア', description: '価値の高い駒を攻撃して動かし、後ろの駒を取ります。' },
  { key: 'discoveredAttack', name: 'ディスカバードアタック', description: '駒を動かして、後ろの駒の攻撃を開通させます。' },
  { key: 'doubleCheck', name: '両王手', description: '2つの駒で同時にチェック。キングを動かすしかありません。' },
  { key: 'hangingPiece', name: 'タダ取り', description: '守られていない駒を取ります。' },
  { key: 'trappedPiece', name: '閉じ込められた駒', description: '逃げ場のない駒を捕まえます。' },
  { key: 'deflection', name: 'デフレクション', description: '大事な守りの駒を、別の場所におびき出します。' },
  { key: 'attraction', name: '誘引', description: '相手の駒(特にキング)を、狙いのマスに引き寄せます。' },
  { key: 'capturingDefender', name: '守り駒を取る', description: '守っている駒を先に取って、守られていた駒を取ります。' },
  { key: 'sacrifice', name: '駒の犠牲', description: 'あえて駒を捨てて、もっと大きな利益を得ます。' },
  { key: 'quietMove', name: '静かな手', description: '取りもチェックもない手が、じつは決め手です。' },
  { key: 'promotion', name: 'プロモーション', description: 'ポーンを成らせて勝ちにつなげます。' },
  { key: 'endgame', name: 'エンドゲーム', description: '駒が少なくなった終盤の局面です。' },
  { key: 'middlegame', name: 'ミドルゲーム', description: '中盤の局面です。' },
  { key: 'opening', name: 'オープニング', description: '序盤の局面です。' },
];

const BY_KEY = new Map(THEME_LIST.map((t) => [t.key, t]));

export function themeInfo(key: string): ThemeInfo | undefined {
  return BY_KEY.get(key);
}

/** テーマ別練習で選べるテーマ(局面の時期を表すものは除く) */
export const PRACTICE_THEMES = THEME_LIST.filter(
  (t) => !['endgame', 'middlegame', 'opening'].includes(t.key),
);
