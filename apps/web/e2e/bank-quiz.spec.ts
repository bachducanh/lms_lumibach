import { test, expect, type Page } from '@playwright/test';

/**
 * Trình dựng đề của quiz MẪU trong kho.
 *
 * Nguồn câu hỏi ở đây là ngân hàng câu hỏi của DANH MỤC, không phải kho của một
 * lớp — hai đường dẫn "tạo câu hỏi" và "xem ngân hàng" phải trỏ về kho danh mục,
 * nếu không giáo viên bấm xong lạc sang màn hình của lớp và không hiểu vì sao
 * câu vừa tạo không xuất hiện.
 */

const EMAIL = process.env.E2E_EMAIL ?? 'admin@lumibach.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@123';
const CATEGORY = process.env.E2E_BANK_CATEGORY ?? 'probe-cat';

async function dangNhap(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** Tạo một quiz mẫu mới rồi trả về trang quản lý câu hỏi của nó. */
async function moQuizMoi(page: Page): Promise<string> {
  await page.goto(`/question-banks/${CATEGORY}/content`);
  await page.getByRole('button', { name: 'Thêm hoạt động' }).first().click();
  await page.getByRole('menuitem', { name: 'Trắc nghiệm' }).click();
  await page.getByPlaceholder(/Tên trắc nghiệm/i).fill(`Quiz e2e ${Date.now()}`);
  await page.getByRole('button', { name: 'Tạo & soạn' }).click();

  await page.waitForURL(/\/quizzes\/[^/]+\/edit/, { timeout: 30_000 });
  return page.url();
}

test('tạo quiz trong kho rồi thêm câu hỏi cho nó', async ({ page }) => {
  // Bài này đi qua ba route chưa được biên dịch; trần 30 giây mặc định của
  // Playwright là quá chặt với dev server.
  test.slow();
  const loi: string[] = [];
  page.on('pageerror', (e) => loi.push(e.message));

  await dangNhap(page);
  const editUrl = await moQuizMoi(page);

  // Từ trang cấu hình sang trang câu hỏi.
  await page.getByRole('link', { name: /Câu hỏi/ }).click();
  await page.waitForURL(/\/manage$/, { timeout: 30_000 });
  await expect(page.getByText('Quản lý câu hỏi')).toBeVisible();

  // Lối tạo câu hỏi phải trỏ về kho DANH MỤC, không phải kho của lớp.
  const taoMoi = page.getByRole('link', { name: 'Tạo câu hỏi mới' });
  await expect(taoMoi).toBeVisible();
  await expect(taoMoi).toHaveAttribute(
    'href',
    new RegExp(`/question-banks/${CATEGORY}/questions/new`)
  );

  expect(loi, 'không được có lỗi JS').toEqual([]);

  // Ngân hàng câu hỏi của danh mục phải hiện ra để chọn.
  await expect(page.getByText('Danh mục câu hỏi')).toBeVisible();

  await expect(page.getByText(/Chưa có danh mục câu hỏi nào/)).toHaveCount(0);

  // Chọn thư mục câu hỏi — đúng hai bước giáo viên đi.
  await page.getByRole('button', { name: /Chưa phân danh mục/ }).click();
  await expect(
    page.getByText('Câu hỏi dò lỗi?').first(),
    'câu hỏi của kho phải hiện ra sau khi chọn thư mục'
  ).toBeVisible();

  // "Thêm ngẫu nhiên": đường này từng ghi vào CSDL mà màn hình không đổi, nên
  // giáo viên thấy câu hỏi biến mất khỏi ngân hàng và không vào quiz.
  await page.getByRole('button', { name: 'Thêm ngẫu nhiên' }).click();
  await expect(page.getByText(/Câu hỏi trong quiz \(1\)/)).toBeVisible({ timeout: 10_000 });

  expect(loi, 'không được có lỗi JS').toEqual([]);

  const editHref = new URL(editUrl).pathname;
  expect(editHref).toContain('/content/quizzes/');
});
