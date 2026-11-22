import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Library build: ESM only, React/Mantine left to the consumer, one explicit stylesheet.
 * CSS module classes get stable `psui-` names so consumers can inspect and, if needed,
 * override them; the JavaScript never imports the stylesheet itself.
 */
export default defineConfig({
  plugins: [react()],
  css: { modules: { generateScopedName: 'psui-[local]' } },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        theme: 'src/theme.ts',
        dynamic: 'src/dynamic/index.ts',
        'dynamic-data': 'src/dynamic/data.ts',
      },
      formats: ['es'],
      cssFileName: 'styles',
    },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^@mantine\//],
    },
  },
});
