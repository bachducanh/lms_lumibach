import { test, expect, type Page } from '@playwright/test';

/**
 * Câu trả lời ngắn + công thức toán, đi đúng đường giáo viên soạn đề.
 *
 * Hai thứ được kiểm ở đây mà test đơn vị không với tới:
 *   - Loại "Trả lời ngắn" có thật trong trình chọn, lưu được xuống DB (enum mới
 *     phải đã migrate), và hiện lại trong kho.
 *   - Công thức gõ bằng $...$ được KaTeX dựng ở màn hình chỉ-đọc, cả trong đề
 *     bài lẫn trong đáp án — đáp án là ô chữ thuần nên đi đường khác đề bài.
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

/**
 * Kho `probe-cat` được các bài e2e khác đếm số câu, nên bài này KHÔNG được để
 * lại câu hỏi nào. Dọn kể cả khi bài đỏ giữa chừng.
 */
let nhanCanDon = '';

test.afterEach(async ({ page }) => {
  if (!nhanCanDon) return;
  const nhan = nhanCanDon;
  nhanCanDon = '';
  const res = await page.request.get(`/api/v1/questions/bank-categories/${CATEGORY}`);
  if (!res.ok()) return;
  // API bọc mọi phản hồi trong { success, data }.
  const { data } = (await res.json()) as {
    data: {
      folders?: { questions?: { id: string; content: string }[] }[];
      uncategorized?: { id: string; content: string }[];
    };
  };
  const tatCa = [
    ...(data.folders ?? []).flatMap((f) => f.questions ?? []),
    ...(data.uncategorized ?? []),
  ];
  for (const q of tatCa.filter((q) => q.content.includes(nhan))) {
    await page.request.delete(`/api/v1/questions/${q.id}`);
  }
});

test('soạn câu trả lời ngắn có công thức rồi xem lại trong kho', async ({ page }) => {
  test.slow();
  const loi: string[] = [];
  page.on('pageerror', (e) => loi.push(e.message));

  await dangNhap(page);
  await page.goto(`/question-banks/${CATEGORY}/questions/new`);

  // Chọn loại — dạng mới phải nằm trong nhóm tự luận.
  await page
    .getByRole('button', { name: /Loại câu hỏi|Trắc nghiệm \(1 đáp án\)/ })
    .first()
    .click();
  await page.getByRole('menuitemradio', { name: 'Trả lời ngắn' }).click();
  await expect(page.getByText('Đáp án được chấp nhận')).toBeVisible();

  // Đề bài: công thức gõ giữa hai dấu đô la, TipTap tự chuyển thành node công thức.
  const nhan = `e2e-tln-${Date.now()}`;
  nhanCanDon = nhan;
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await editor.pressSequentially(`${nhan} Tính $\\frac{1}{2}$ dưới dạng số thập phân.`);

  // Hai cách viết đều phải được chấp nhận.
  await page.getByPlaceholder('Đáp án chính...').fill('0.5');
  await page.getByRole('button', { name: 'Thêm cách viết khác' }).click();
  await page.getByPlaceholder('Cách viết khác cũng tính là đúng...').fill('$\\frac{1}{2}$');

  await page.getByRole('button', { name: 'Tạo câu hỏi' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/questions/new'), { timeout: 30_000 });

  // Mở lại trong kho và bung câu hỏi ra.
  await page.goto(`/question-banks/${CATEGORY}`);
  // Thư mục đóng sẵn: mở hết ra mới thấy câu hỏi.
  await page.getByRole('button', { name: 'Mở rộng' }).click();
  await page.getByRole('menuitem', { name: 'Mở tất cả' }).click();
  const the = page.getByText(nhan).first();
  await expect(the).toBeVisible({ timeout: 30_000 });
  await the.click();

  // Công thức trong ĐỀ BÀI phải được dựng, không còn là chữ thô.
  const khoi = page.locator('[class*="border"]', { hasText: nhan }).last();
  await expect(khoi.locator('.katex').first()).toBeVisible({ timeout: 15_000 });
  // KaTeX vẫn nhúng mã gốc vào phần MathML cho trình đọc màn hình, nên không
  // thể khẳng định chuỗi biến mất. Dấu đô la bị tiêu thụ mới là bằng chứng
  // công thức đã được dựng chứ không nằm im dưới dạng chữ.
  await expect(khoi).not.toContainText('$');

  // Công thức trong ĐÁP ÁN đi qua MathText — đường khác hẳn đề bài.
  await expect(khoi.getByText('0.5')).toBeVisible();
  expect(
    await khoi.locator('.katex').count(),
    'cả đề bài lẫn đáp án đều phải có công thức'
  ).toBeGreaterThan(1);

  expect(loi, 'không được có lỗi JS').toEqual([]);

  await khoi.screenshot({ path: 'test-results/tra-loi-ngan-cong-thuc.png' });
});
