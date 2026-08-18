import { test, expect, type Page } from '@playwright/test';

/**
 * Màn hình "Bài làm" của một quiz.
 *
 * Bảng lượt làm tự nó không bao giờ nêu được nhóm CHƯA LÀM — em nào chưa làm thì
 * không sinh ra dòng nào — mà đó lại đúng là nhóm giáo viên cần nhắc. Trang nay
 * ghép thêm danh sách lớp và có bộ lọc theo trạng thái + tìm theo tên/email.
 *
 * Chuẩn bị: pnpm db:seed && pnpm --filter @lumibach/db db:seed-bank-probe
 * (seed dựng 2 học sinh: Trần Thị B đã nộp, Lê Văn C chưa làm)
 */

const URL_BAI_LAM = '/courses/lop-thu-10e1/quizzes/probe-course-quiz/attempts';

async function dangNhap(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill('admin@lumibach.local');
  await page.locator('input[type="password"]').first().fill('Admin@123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  test.slow();
  await dangNhap(page);
  await page.goto(URL_BAI_LAM);
  await expect(page.getByRole('heading', { name: 'Quiz chấm thử' })).toBeVisible();
});

test('nêu được cả em đã làm lẫn em chưa làm', async ({ page }) => {
  await expect(page.getByText('1 chưa làm')).toBeVisible();

  await expect(page.getByRole('cell', { name: /Trần Thị B/ })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: /Lê Văn C/ }),
    'em chưa làm vẫn phải có mặt trong bảng'
  ).toBeVisible();
  await expect(page.getByText('Chưa làm', { exact: true })).toBeVisible();
});

test('lọc theo trạng thái', async ({ page }) => {
  await page.getByRole('button', { name: /^Chưa làm \(/ }).click();
  await expect(page.getByRole('cell', { name: /Lê Văn C/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Trần Thị B/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Đã nộp' }).click();
  await expect(page.getByRole('cell', { name: /Trần Thị B/ })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: /Lê Văn C/ }),
    'lọc "đã nộp" thì không kể em chưa làm'
  ).toHaveCount(0);
});

test('tìm theo tên hoặc email', async ({ page }) => {
  await page.getByLabel('Tìm học sinh').fill('Lê Văn');
  await expect(page.getByRole('cell', { name: /Lê Văn C/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Trần Thị B/ })).toHaveCount(0);

  await page.getByLabel('Tìm học sinh').fill('student@lumibach.local');
  await expect(page.getByRole('cell', { name: /Trần Thị B/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Lê Văn C/ })).toHaveCount(0);
});
