import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** ビルド後、dist/sw.js の __BUILD_ID__ をビルド時刻に置き換える(更新時にキャッシュを作り直すため) */
function swBuildId() {
  return {
    name: 'sw-build-id',
    apply: 'build' as const,
    closeBundle: {
      order: 'post' as const,
      handler() {
        const file = resolve(__dirname, 'dist/sw.js');
        if (!existsSync(file)) return;
        writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', String(Date.now())));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildId()],
  base: './',
  test: { environment: 'node' },
});
