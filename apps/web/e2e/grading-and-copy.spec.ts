import { test, expect, type Page } from '@playwright/test';

/**
 * Hai lỗi người dùng gặp sau khi triển khai, đều chỉ lộ ra khi có người bấm:
 *
 *  1. Hoạt động chép từ ngân hàng chung -> học sinh mở lên gặp trang 404.
 *     Hệ thống có hai cờ cho cùng một ý "học sinh thấy được"
 *     (ModuleItem.isPublished và status của nội dung), mà giao diện chỉ bày một.
 *     Bản chép từ kho luôn ra đời ở DRAFT nên bật con mắt là lệch hai cờ.
 *
 *  2. Màn hình chấm bài: bấm từ bài học sinh này sang học sinh khác thì tên đổi
 *     nhưng phần bài làm, ô điểm và ô nhận xét vẫn là của người trước. Nguy hiểm
 *     hơn hiển thị sai: bấm Lưu là ghi điểm sang nhầm người.
 *
 * Chuẩn bị: pnpm db:seed && pnpm --filter @lumibach/db db:seed-bank-probe
 */

const TEACHER = { email: 'admin@lumibach.local', password: 'Admin@123' };
const STUDENT = { email: 'student@lumibach.local', password: 'Admin@123' };
const COURSE = 'lop-thu-10e1';
const CATEGORY = 'probe-cat';

async function dangNhap(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill(who.email);
  await page.locator('input[type="password"]').first().fill(who.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/**
 * Trang 404 của Next được stream nên mã HTTP vẫn là 200 — phải nhận ra nó qua
 * nội dung, không qua status code.
 */
async function laTrang404(page: Page) {
  return page
    .getByRole('heading', { name: '404' })
    .isVisible()
    .catch(() => false);
}

test('hoạt động chép từ kho, sau khi bật hiện, học sinh mở được', async ({ page, browser }) => {
  await dangNhap(page, TEACHER);

  // Chép một hoạt động của kho về chương của lớp.
  await page.goto(`/courses/${COURSE}/modules/bank`);
  // Chương đích mặc định đã là 'Chương 1', không cần đổi.
  const nutChep = page.getByRole('button', { name: /Chép về chương/ }).first();
  await expect(nutChep, 'kho phải có ít nhất một hoạt động để chép').toBeVisible({
    timeout: 15_000,
  });
  await nutChep.click();
  await expect(page.getByRole('button', { name: /Chép lần nữa/ }).first()).toBeVisible({
    timeout: 15_000,
  });

  // Bật hiển thị cho mục vừa chép — qua đúng menu giáo viên dùng.
  await page.goto(`/courses/${COURSE}/modules`);
  await page.getByRole('button', { name: 'Mở menu thao tác', exact: true }).last().click();
  await page.getByRole('menuitem', { name: 'Hiển thị' }).click();
  await page.waitForTimeout(2000);

  // Học sinh mở đúng hoạt động đó — PHẢI dùng context riêng, nếu không trang
  // mới vẫn mang cookie của giáo viên và phép thử mất hết ý nghĩa.
  const ctxHS = await browser.newContext();
  const trangHS = await ctxHS.newPage();
  await dangNhap(trangHS, STUDENT);
  await trangHS.goto(`/courses/${COURSE}/modules`);
  const mucMoi = trangHS.getByRole('link', { name: /Thử ASSIGNMENT/ }).first();
  await expect(mucMoi, 'học sinh phải thấy hoạt động vừa được bật').toBeVisible({
    timeout: 15_000,
  });
  await mucMoi.click();

  await expect(await laTrang404(trangHS), 'học sinh không được rơi vào trang 404').toBe(false);
  await ctxHS.close();
});

test('chấm bài: đổi học sinh thì bài làm và ô điểm phải theo đúng người', async ({ page }) => {
  await dangNhap(page, TEACHER);
  await page.goto(`/courses/${COURSE}/assignments/probe-course-asg/submissions`);

  const hs1 = page.getByRole('link', { name: /Trần Thị B/ }).first();
  const hs2 = page.getByRole('link', { name: /Lê Văn C/ }).first();

  await hs1.click();
  await expect(page.getByText('BAI-LAM-CUA-HOC-SINH-1')).toBeVisible({ timeout: 15_000 });
  // Học sinh 1 đã có điểm 7 và nhận xét.
  await expect(page.getByRole('spinbutton').first()).toHaveValue('7');

  // Đổi sang học sinh 2 — KHÔNG tải lại trang, đúng thao tác giáo viên làm.
  await hs2.click();
  await expect(page.getByText('BAI-LAM-CUA-HOC-SINH-2')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText('BAI-LAM-CUA-HOC-SINH-1'),
    'bài của học sinh trước không được còn trên màn hình'
  ).toHaveCount(0);

  // Đây mới là chỗ nguy hiểm: ô điểm phải trống, không phải điểm 7 của bạn kia.
  await expect(
    page.getByRole('spinbutton').first(),
    'ô điểm phải trống với học sinh chưa chấm'
  ).toHaveValue('');
});
