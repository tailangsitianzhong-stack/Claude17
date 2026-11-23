#!/usr/bin/env python3
"""Lichess オープンパズルDB (CC0) から、アプリ用の小さなパズル集を作る。

使い方:
  curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
  pip install zstandard
  python3 tools/build-puzzles.py lichess_db_puzzle.csv.zst public/puzzles/puzzles.json

テーマ x レーティング帯ごとに、人気の高いパズルを一定数ずつ選ぶ。
"""
import csv
import io
import json
import random
import sys
from collections import defaultdict

import zstandard

# 優先順位つきのテーマ(先に一致したものが「主テーマ」)
THEMES = [
    'mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate',
    'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck',
    'hangingPiece', 'trappedPiece', 'deflection', 'attraction',
    'capturingDefender', 'sacrifice', 'quietMove', 'promotion',
]
EXTRA = {'endgame', 'middlegame', 'opening'}
KEEP = set(THEMES) | EXTRA

BUCKETS = list(range(400, 2600, 200))  # 400-599, ..., 2400-2599
PER_BUCKET = 8
MAX_PLIES = 8  # 先頭の相手の手 + 自分の手が最大4手


def main(src: str, dst: str) -> None:
    rng = random.Random(42)
    pool = defaultdict(list)  # (主テーマ, バケット) -> [puzzle]
    with open(src, 'rb') as f:
        reader = zstandard.ZstdDecompressor().stream_reader(f)
        rows = csv.DictReader(io.TextIOWrapper(reader, encoding='utf-8'))
        for row in rows:
            try:
                rating = int(row['Rating'])
                dev = int(row['RatingDeviation'])
                pop = int(row['Popularity'])
                plays = int(row['NbPlays'])
            except ValueError:
                continue
            if dev > 90 or pop < 90 or plays < 300:
                continue
            moves = row['Moves'].split()
            if len(moves) < 2 or len(moves) > MAX_PLIES:
                continue
            themes = row['Themes'].split()
            primary = next((t for t in THEMES if t in themes), None)
            if primary is None:
                continue
            b = (rating - 400) // 200
            if b < 0 or b >= len(BUCKETS):
                continue
            pool[(primary, b)].append(
                {
                    'i': row['PuzzleId'],
                    'f': row['FEN'],
                    'm': ' '.join(moves),
                    'r': rating,
                    't': [t for t in themes if t in KEEP],
                    '_p': pop * 100000 + plays,
                }
            )

    out = []
    for (_, _), items in sorted(pool.items()):
        items.sort(key=lambda p: (-p['_p'], p['i']))
        top = items[: PER_BUCKET * 3]
        rng.shuffle(top)
        out.extend(top[:PER_BUCKET])
    for p in out:
        del p['_p']
    out.sort(key=lambda p: p['r'])
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{len(out)} puzzles -> {dst}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
