import { defineConfig } from 'vitest/config';
import { isManifestModule, stripManifestDescriptions } from './src/build/stripManifestDescriptions';

export default defineConfig({
  base: './',
  plugins: [
    {
      // Build only (vitest and the dev server keep the descriptions): the manifest's description lines are documentation, read by the
      // generated ASSET_GUIDE and the manifest tests, never at runtime. Keeps the app chunk inside P14.
      name: 'strip-manifest-descriptions',
      apply: 'build',
      enforce: 'pre',
      transform(code: string, id: string) {
        return isManifestModule(id) ? { code: stripManifestDescriptions(code), map: null } : null;
      },
    },
  ],
  build: {
    // Phaser 3.90 minifies to ~1.48 MB on its own; keep it in a separate chunk so
    // the app chunk stays small and cacheable. The warning limit sits just above
    // the measured Phaser chunk so only a regression in the app chunk is flagged.
    // Director ruling 2026-10-29 (WP28 Q14/Q8 option a): es2022 output, the tsconfig target; keeps the lazy world chunks inside their budgets.
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
