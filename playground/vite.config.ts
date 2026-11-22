import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dist = (file: string) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));

/**
 * The playground consumes the built package (`yarn build` first), exactly as an application
 * would: these aliases mirror the package `exports` map.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@prostriveorg\/ui$/, replacement: dist('index.js') },
      { find: /^@prostriveorg\/ui\/theme$/, replacement: dist('theme.js') },
      { find: /^@prostriveorg\/ui\/dynamic$/, replacement: dist('dynamic.js') },
      { find: /^@prostriveorg\/ui\/dynamic\/data$/, replacement: dist('dynamic-data.js') },
      { find: /^@prostriveorg\/ui\/styles\.css$/, replacement: dist('styles.css') },
      { find: /^@prostriveorg\/ui\/fonts\.css$/, replacement: dist('fonts.css') },
      // Production React ignores <Profiler>; its profiling build keeps the render counter used
      // by scripts/browser-check.mjs working in the built playground.
      { find: /^react-dom\/client$/, replacement: 'react-dom/profiling' },
    ],
  },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
