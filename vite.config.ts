import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    // Phaser 3.90 minifies to ~1.48 MB on its own; keep it in a separate chunk so
    // the app chunk stays small and cacheable. The warning limit sits just above
    // the measured Phaser chunk so only a regression in the app chunk is flagged.
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
