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
    // BẮT BUỘC đi kèm singleFork. `singleFork` chỉ gom mọi file vào MỘT tiến
    // trình, nó KHÔNG khiến các file chạy lần lượt: Vitest vẫn xen kẽ chúng
    // bằng bất đồng bộ. Mà mọi file lại dùng chung một DB test và cùng chạy
    // TRUNCATE ở beforeEach — nên lệnh xoá của file này quét mất dữ liệu file
    // kia đang dùng dở, sinh ra lỗi "khoá ngoại không tồn tại" hoặc 401 rải rác,
    // chạy riêng từng file thì lại xanh. Tắt chạy song song để loại hẳn lớp lỗi này.
    fileParallelism: false,
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
