/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Beam Run build config.
 *
 * - `vite` (dev) serves index.html for local play.
 * - `vite build` produces a library: ESM (`beam-run.esm.js`) for React import
 *   and IIFE (`beam-run.iife.js`) exposing `window.BeamRun`.
 *
 * The game must never sit on the host page's critical path, so the library is
 * intended to be lazy-loaded (IntersectionObserver / explicit Play) — see the
 * embed layer (Task 15).
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BeamRun',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'beam-run.esm.js' : 'beam-run.iife.js'),
    },
    rollupOptions: {
      // React is a peer dependency for the optional <BeamRun/> wrapper.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.mjs',
    ],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
}));
