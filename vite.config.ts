/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { minify } from 'terser';
// @ts-expect-error — plain-JS build helper, no types needed.
import { cssMinifyPlugin } from './scripts/css-minify.mjs';

/**
 * Minify the ESM output.
 *
 * Vite skips terser for `lib` builds in `es` format on purpose (it assumes a
 * library consumer re-bundles and minifies). This is not that kind of library:
 * it is a self-contained widget that hosts load as-is, and the performance
 * budget is measured on what ships. Left alone, `beam-run.esm.js` went out
 * completely unminified — 197 KB raw / 54 KB gzipped against a 113 KB / 35 KB
 * UMD build of the same code, which was most of the pressure on the 90 KB gate.
 */
function minifyEsOutput(): PluginOption {
  return {
    name: 'beam-run:minify-es',
    apply: 'build',
    async renderChunk(code, _chunk, outputOptions) {
      if (outputOptions.format !== 'es') return null;
      const res = await minify(code, {
        module: true,
        compress: { passes: 2 },
        format: { comments: false },
        sourceMap: !!outputOptions.sourcemap,
      });
      return res.code ? { code: res.code, map: (res.map as never) ?? null } : null;
    },
  };
}

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
    minifyEsOutput(),
    // The scoped stylesheet is a TS template literal, so nothing else minifies
    // it; see scripts/css-minify.mjs.
    cssMinifyPlugin(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    // A second compress pass is worth ~1 KB gzipped across the two library
    // formats (the gate counts both), which is real headroom on a 90 KB budget.
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
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
