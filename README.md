# チェス道場

初心者から上級者までチェスを学べる、スマホ向けのローカル用 Web アプリ。
インタラクティブなレッスン + Stockfish との CPU 対戦(コーチ・ヒント・待った付き)。
サーバー不要、進捗はブラウザの localStorage に保存されます。

## 使い方

```bash
npm install --include=dev   # NODE_ENV=production の環境では --include=dev が必要
npm run dev                 # 同じ Wi-Fi のスマホから http://<PCのIP>:5173 で開ける
npm test                    # レッスン内容(FEN・正解手)の検証
npm run build && npm run preview
```

## 構成

- `src/engine/` Stockfish 18 (lite, single-thread WASM) を Web Worker で動かすラッパーと CPU レベル定義
- `src/components/Board.tsx` タップ/ドラッグ対応の盤面(react-chessboard + chess.js)
- `src/features/lessons/` レッスンプレイヤー(説明・実践・クイズの3種類のステップ)
- `src/features/play/` CPU 対戦(強さ10段階・コーチ・ヒント・待った)
- `src/content/` カリキュラム(コードと分離したデータ。`content.test.ts` で全局面を検証)
- `public/stockfish/` エンジン本体(GPLv3。個人利用のみ想定)

## ロードマップ

- [x] Phase 0〜2: 盤面、CPU 対戦、レベル1レッスン(13本)
- [ ] Phase 3: パズル(Lichess オープンDB から抜粋)
- [ ] Phase 4: 対局後の自動解析・評価グラフ
- [ ] Phase 5: レベル2〜4 のレッスン
- [ ] Phase 6: PWA 化(ホーム画面追加・オフライン)・XP/連続日数
