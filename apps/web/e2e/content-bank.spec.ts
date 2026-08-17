import { test, expect, type Page } from '@playwright/test';

/**
 * Kho nội dung của danh mục — các thao tác chỉ chạy ở phía client.
 *
 * Vì sao cần đúng một trình duyệt thật: ba lỗi liên tiếp của màn hình này đều
 * KHÔNG bắt được bằng type-check, lint, build hay gọi HTTP. Chúng chỉ lộ ra khi
 * có người bấm:
 *   - hộp thoại xác nhận không bao giờ hiện (openConfirm gói trong startTransition)
 *   - nút sửa/xoá vô hình (ẩn tới khi rê chuột)
 *   - menu "Thêm hoạt động" hạ cả trang (Base UI GroupLabel thiếu Group bọc ngoài)
 *
 * Chuẩn bị:
 *   pnpm db:seed                                        # tài khoản admin
 *   pnpm --filter @lumibach/db db:seed-bank-probe       # danh mục + chương thử
 *   pnpm web:dev  &&  pnpm api:dev
 *   pnpm --filter @lumibach/web exec playwright test content-bank
 */

const EMAIL = process.env.E2E_EMAIL ?? 'admin@lumibach.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@123';
const CATEGORY = process.env.E2E_BANK_CATEGORY ?? 'probe-cat';

async function dangNhap(page: Page) {
  await page.goto('/login');
  // Ô định danh là type="text", không phải "email": nó nhận cả tên đăng nhập.
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** Trang lỗi của Next hiện ra là hỏng, dù HTTP vẫn 200. */
async function khongCoTrangLoi(page: Page) {
  await expect(page.getByText(/Đã có lỗi|Something went wrong|Application error/i)).toHaveCount(0);
}

test.describe('Kho nội dung', () => {
  test.beforeEach(async ({ page }) => {
    await dangNhap(page);
    await page.goto(`/question-banks/${CATEGORY}/content`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('menu Thêm hoạt động mở được và liệt kê đủ sáu lối vào', async ({ page }) => {
    const loi: string[] = [];
    page.on('pageerror', (e) => loi.push(e.message));

    await page.getByRole('button', { name: 'Thêm hoạt động' }).first().click();

    // Menu phải mở ra, không phải trang sập.
    for (const nhan of ['Bài giảng', 'Bài tập', 'Trắc nghiệm', 'Bài code', 'Đề luyện tập']) {
      await expect(page.getByRole('menuitem', { name: nhan })).toBeVisible();
    }
    await expect(page.getByRole('menuitem', { name: /Chép từ lớp/ })).toBeVisible();

    await khongCoTrangLoi(page);
    expect(loi, 'không được có lỗi JS nào khi mở menu').toEqual([]);
  });

  test('nút sửa và xoá hiện sẵn, không phải rê chuột mới thấy', async ({ page }) => {
    const hang = page.locator('li').filter({ hasText: 'Bài giảng thử' }).first();

    // toBeVisible() của Playwright coi opacity:0 là VẪN hiện, nên phải đo thật.
    for (const ten of [/^Sửa /, /^Xoá /]) {
      const nut = hang.getByRole('link', { name: ten }).or(hang.getByRole('button', { name: ten }));
      await expect(nut.first()).toBeVisible();
      const opacity = await nut.first().evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(opacity), 'nút không được trong suốt').toBeGreaterThan(0.5);
    }
  });

  test('bấm thùng rác thì hộp thoại xác nhận hiện ra', async ({ page }) => {
    const hang = page.locator('li').filter({ hasText: 'Bài giảng thử' }).first();
    await hang.getByRole('button', { name: /^Xoá / }).click();

    // Đây là chỗ từng khoá chết: hộp thoại không bao giờ được vẽ.
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Xác nhận' })).toBeVisible();

    // Huỷ để phép kiểm không đụng vào dữ liệu.
    await page.getByRole('button', { name: 'Huỷ' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('hộp thoại chép từ lớp mở được', async ({ page }) => {
    await page.getByRole('button', { name: 'Thêm hoạt động' }).first().click();
    await page.getByRole('menuitem', { name: /Chép từ lớp/ }).click();

    await expect(page.getByRole('dialog', { name: /Chép hoạt động/ })).toBeVisible();
    await khongCoTrangLoi(page);
  });

  test('chọn một loại trong menu thì hiện ô đặt tên', async ({ page }) => {
    await page.getByRole('button', { name: 'Thêm hoạt động' }).first().click();
    await page.getByRole('menuitem', { name: 'Bài tập' }).click();

    await expect(page.getByPlaceholder(/Tên bài tập/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo & soạn' })).toBeVisible();
    await khongCoTrangLoi(page);
  });
});
