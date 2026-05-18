import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config cho NestJS BE.
 *
 * Lý do dùng SWC: NestJS dùng heavy decorator metadata (@Injectable, @Controller,
 * DI tokens, Reflect.getMetadata). Vitest mặc định dùng esbuild — không emit
 * decorator metadata. SWC bật `decoratorMetadata: true` mới đủ cho DI hoạt động.
 *
 * Pool = forks, singleFork = true:
 *   Tests đụng cùng 1 DB test (truncate giữa các test). Chạy SERIAL để không race.
 *   Sau khi có nhiều test suite có thể tách DB-per-worker (parallel).
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.{e2e-spec,spec}.ts', 'src/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.module.ts', 'src/**/*.dto.ts', 'src/main.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        keepClassNames: true,
      },
    }),
  ],
});
