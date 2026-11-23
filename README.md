# チェス道場

初心者から上級者までチェスを学べる、スマホ向けのローカル用 Web アプリ。
インタラクティブなレッスン + Stockfish との CPU 対戦(コーチ・ヒント・待った付き)。
サーバー不要、進捗はブラウザの localStorage に保存されます。

## 使い方

```bash
npm install --include=dev   # NODE_ENV=production の環境では --include=dev が必要
npm run dev                 # 同じ Wi-Fi のスマホから http://<PCのIP>:5173 で開ける
npm test                    # レッスン内容・パズル判定の検証
VERIFY_ENGINE=1 npx vitest run src/content/engine-verify.test.ts   # 正解手・定跡・詰み手数・練習局面を Stockfish で検証(任意)
npm run build && npm run preview
```

## スマホで使う(ホーム画面に追加・オフライン)

PWA として動きます。ホーム画面に追加すると、アプリのように起動でき、**一度開けばオフラインでも**
レッスン・パズル・CPU対戦(エンジン含む)が使えます。

ただし Service Worker は **https(または localhost)でないと動きません**。
LAN 内の `http://<PCのIP>:5173` では通常のWebページとして動くだけです。スマホにインストールしたい場合は、
`npm run build` で作った `dist/` を、GitHub Pages / Cloudflare Pages / Netlify などの静的ホスティングに置いてください
(相対パスなので、サブパス配下でも動きます)。

- 進捗・戦績・対局履歴は、そのブラウザの localStorage に保存されます(端末をまたいだ同期はありません)。
- 更新を配信すると、次回起動時にキャッシュが自動で作り直されます(`sw.js` のビルドIDで管理)。

## 構成

- `src/engine/` Stockfish 18 (lite, single-thread WASM) を Web Worker で動かすラッパーと CPU レベル定義
- `src/components/Board.tsx` タップ/ドラッグ対応の盤面(react-chessboard + chess.js)
- `src/features/lessons/` レッスンプレイヤー(説明・実践・クイズの3種類のステップ)
- `src/features/play/` CPU 対戦(強さ10段階・コーチ・ヒント・待った)
- `src/store/progress.ts` XP・ランク・連続日数・バッジの純粋ロジック(テスト付き)
- `public/sw.js` オフライン用 Service Worker(本体はビルドごと、エンジンとパズルは別キャッシュ)
- `src/features/analysis/` 対局後の解析(局面ごとにエンジン評価→勝率の落ち幅で ?! / ? / ?? を判定、評価グラフ、手順リスト)
- `src/features/puzzles/` パズル(出題・判定・レーティング)
- `tools/build-puzzles.py` Lichess パズルDB(CC0)から `public/puzzles/puzzles.json` を作るスクリプト
- `src/content/` カリキュラム(コードと分離したデータ。`content.test.ts` で全局面を検証)
- `public/stockfish/` エンジン本体(GPLv3。個人利用のみ想定)

## ロードマップ

- [x] Phase 0〜2: 盤面、CPU 対戦、レベル1レッスン(13本)
- [x] Phase 3: パズル(Lichess オープンDB から1,464問、レーティング・テーマ別・復習)
- [x] Phase 4: 対局後の自動解析(評価グラフ・悪手の指摘・正確度・対局履歴20局)
- [x] レベル2 のレッスン(9本。CPU相手の詰ませ練習つき)
- [x] レベル3 のレッスン(10本。定跡の手順練習、二手詰め・三手詰め、ポーン構造、ルシェーナ/フィリドール)
- [x] レベル4 のレッスン(11本。局面評価、アウトポスト、K+Pの終盤、ルーク終盤応用、攻撃、計算、名局研究2局)
- [x] Phase 6: PWA 化(ホーム画面追加・オフライン対応)、XP・ランク・連続学習日数・今日の目標・バッジ17種
