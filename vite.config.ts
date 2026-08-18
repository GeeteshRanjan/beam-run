/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { minify } from 'terser';
// @ts-expect-error — plain-JS build helper, no types needed.
import { cssMinifyPlugin } from './scripts/css-minify.mjs';
import { notFoundPagePlugin } from './scripts/not-found-plugin';

/**
 * Minify the ESM output.
 *
 * Vite skips terser for `lib` builds in `es` format on purpose (it assumes a
 * library consumer re-bundles and minifies). This is not that kind of library:
 * it is a self-contained widget that hosts load as-is, and the performance
 * budget is measured on what ships. Left alone, `beam-run.esm.js` went out
 * completely unminified — 197 KB raw / 54 KB gzipped against a 113 KB / 35 KB
 * UMD build of the same code, which was most of the pressure on the 90 KB gate.
 *
 * **This has to run in `generateBundle`, not `renderChunk`.** It used to be a
 * `renderChunk` hook, which looked like it worked — the hook ran, terser returned
 * 135 KB — and yet a 176 KB file landed on disk. Vite's own
 * `vite:esbuild-transpile` runs in the post phase, *after* every normal plugin's
 * renderChunk, and re-prints the chunk for the build target: mangled identifiers
 * survived that (which is why the output looked minified at a glance) but all the
 * whitespace came back, along with 5 KB of gzip. `generateBundle` is the last
 * hook to see the chunk, so nothing can re-print it afterwards.
 *
 * The regression was silent for exactly this reason, so `budget.test.mjs` now
 * asserts the two bundles stay within a few KB of each other — the es build being
 * much larger than the umd build is the signature of this bug.
 */
function minifyEsOutput(): PluginOption {
  return {
    name: 'beam-run:minify-es',
    apply: 'build',
    enforce: 'post',
    async generateBundle(outputOptions, bundle) {
      if (outputOptions.format !== 'es') return;
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        const res = await minify(file.code, {
          module: true,
          compress: { passes: 2 },
          format: { comments: false },
          // Chain onto the map Vite already produced, so stack traces still
          // resolve to the TypeScript sources.
          sourceMap: file.map
            ? { content: file.map as never, includeSources: true, asObject: true }
            : false,
        });
        if (!res.code) continue;
        file.code = res.code;
        if (res.map) file.map = res.map as never;
      }
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
    // Dev server: answer unmatched routes (the Navigator deep link) with the
    // game's own 404 screen instead of Vite's SPA fallback.
    notFoundPagePlugin(),
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
