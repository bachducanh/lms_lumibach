import { test, expect, type Page } from '@playwright/test';

/**
 * Ngân hàng nội dung nhìn từ một khoá học: PHẠM VI và cách bày.
 *
 * Phạm vi từng rò: bản cũ lấy toàn bộ cây con của MỌI tổ tiên, nên tổ tiên cao
 * nhất kéo theo cả cây — trường có một danh mục gốc chung là mọi lớp nhìn thấy
 * kho của nhau, kể cả khác khối. Đúng phải là: đường dẫn của chính lớp, cộng
 * cây con của nó.
 *
 * Chuẩn bị: pnpm db:seed && pnpm --filter @lumibach/db db:seed-bank-probe
 */

const CHECK_COURSE = 'tin-10e1';

async function dangNhap(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill('admin@lumibach.local');
  await page.locator('input[type="password"]').first().fill('Admin@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test('kho chỉ hiện nội dung trên đường dẫn của lớp, không lấn nhánh khác', async ({ page }) => {
  await dangNhap(page);
  await page.goto(`/courses/${CHECK_COURSE}/modules/bank`);
  await expect(page.getByRole('heading', { name: 'Ngân hàng nội dung' })).toBeVisible();

  // Lớp nằm ở Trường / Khối 10 / 10E1.
  await expect(page.getByText('KHO-TRUONG'), 'kho của tổ tiên phải thấy').toHaveCount(1);
  await expect(page.getByText('KHO-KHOI-10'), 'kho của khối mình phải thấy').toHaveCount(1);

  // Nhánh anh em — KHÔNG được thấy.
  await expect(page.getByText('KHO-KHOI-12'), 'không được thấy kho khối khác').toHaveCount(0);
  await expect(page.getByText('KHO-12A5'), 'không được thấy kho lớp khối khác').toHaveCount(0);
});

test('hoạt động gom theo chương, bấm vào mới đổ xuống', async ({ page }) => {
  await dangNhap(page);
  await page.goto(`/courses/${CHECK_COURSE}/modules/bank`);

  const chuong = page.getByRole('button', { expanded: false }).filter({ hasText: 'KHO-KHOI-10' });
  await expect(chuong, 'mỗi chương là một dòng đóng sẵn').toHaveCount(1);

  // Đóng thì chưa thấy nút chép của hoạt động bên trong.
  await expect(page.getByRole('button', { name: /Chép về chương/ })).toHaveCount(0);

  await chuong.click();
  await expect(page.getByRole('button', { name: /Chép về chương/ }).first()).toBeVisible();
});
