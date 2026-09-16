import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest cho apps/web — CHỈ dành cho logic thuần (không DOM, không React).
 *
 * Hiện dùng cho bộ phân tích mẫu nhập đề từ Word: nó biến một danh sách dòng
 * thành câu hỏi, không đụng trình duyệt, và là chỗ dễ sai nhất của tính năng.
 * Phần chạm DOM vẫn kiểm bằng Playwright ở thư mục e2e.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
