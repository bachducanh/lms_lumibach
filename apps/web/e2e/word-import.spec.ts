import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';

/**
 * Nhập đề từ tệp Word, đi đúng đường giáo viên đi: chọn tệp, soát bản xem
 * trước, rồi bấm nhập.
 *
 * Tệp dùng ở đây là .docx thật, dựng ngay trong bài kiểm, có công thức Office
 * bên trong. Đó là mắt xích duy nhất không thể kiểm bằng test đơn vị: nó chạy
 * ở máy chủ, đi qua bộ đổi công thức rồi mới tới trình duyệt.
 */

const EMAIL = process.env.E2E_EMAIL ?? 'admin@lumibach.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@123';
const CATEGORY = process.env.E2E_BANK_CATEGORY ?? 'probe-cat';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const doan = (trong: string) => `<w:p>${trong}</w:p>`;
const chu = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const phanSo = (tu: string, mau: string) =>
  `<m:oMath><m:f><m:num><m:r><m:t>${tu}</m:t></m:r></m:num>` +
  `<m:den><m:r><m:t>${mau}</m:t></m:r></m:den></m:f></m:oMath>`;

async function dungDocx(than: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:m="${M}"><w:body>${than}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function dangNhap(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/truong\.edu\.vn/i).fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

/** Kho probe được bài khác đếm số câu, nên bài này phải dọn sạch dấu vết. */
let nhanCanDon = '';

test.afterEach(async ({ page }) => {
  if (!nhanCanDon) return;
  const nhan = nhanCanDon;
  nhanCanDon = '';
  const res = await page.request.get(`/api/v1/questions/bank-categories/${CATEGORY}`);
  if (!res.ok()) return;
  const { data } = (await res.json()) as {
    data: {
      folders?: { id: string; name: string; questions?: { id: string; content: string }[] }[];
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
  for (const f of data.folders ?? []) {
    if (f.name.includes(nhan)) await page.request.delete(`/api/v1/questions/bank-folders/${f.id}`);
  }
});

test('nhập đề Word có công thức vào kho của danh mục', async ({ page }) => {
  test.slow();
  const loi: string[] = [];
  page.on('pageerror', (e) => loi.push(e.message));

  const nhan = `e2e-word-${Date.now()}`;
  nhanCanDon = nhan;

  const docx = await dungDocx(
    [
      doan(chu(`Thư mục: ${nhan}`)),
      doan(chu(`Câu 1. [TN1] ${nhan} Giá trị của `) + phanSo('1', '2') + chu(' bằng bao nhiêu?')),
      doan(chu('A. 0,5')),
      doan(chu('B. 0,25')),
      doan(chu('Đáp án: A')),
      doan(chu('Điểm: 0,5')),
      doan(chu(`Câu 2. [TLN] ${nhan} Tính `) + phanSo('8', '2') + chu('.')),
      doan(chu('Đáp án: 4')),
      // Câu hỏng có chủ đích: phải bị chặn lại chứ không lọt vào kho.
      doan(chu(`Câu 3. [TN1] ${nhan} Câu này thiếu đáp án`)),
      doan(chu('A. một')),
      doan(chu('B. hai')),
    ].join('')
  );

  await dangNhap(page);
  await page.goto(`/question-banks/${CATEGORY}/questions/import`);
  await expect(page.getByRole('heading', { name: 'Nhập đề từ Word' })).toBeVisible();

  // Tệp mẫu phải tải được ngay từ màn hình này; giáo viên chép từ đó ra đề thật.
  const mau = await page.request.get('/api/word-import/mau');
  expect(mau.ok()).toBe(true);
  expect(mau.headers()['content-type']).toContain('wordprocessingml');
  expect((await mau.body()).byteLength).toBeGreaterThan(2000);
  await expect(page.getByRole('link', { name: 'Tải tệp mẫu' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'de-thu.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docx,
  });

  // Bản xem trước: hai câu dùng được, một câu bị chặn.
  await expect(page.getByText('2 câu sẽ được nhập')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/1 câu lỗi, không nhập được/)).toBeVisible();

  // Công thức Office phải đã thành công thức dựng được, không còn là chữ thô.
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.getByText('Công thức đọc được: 2')).toBeVisible();

  await page.screenshot({ path: 'test-results/nhap-de-word-xem-truoc.png', fullPage: true });

  await page.getByRole('button', { name: /Nhập 2 câu/ }).click();
  await page.waitForURL(`**/question-banks/${CATEGORY}`, { timeout: 30_000 });

  // Về tới kho: thư mục khai trong tệp đã được tạo và hai câu nằm trong đó.
  await expect(page.getByText(nhan).first()).toBeVisible({ timeout: 30_000 });

  const trongKho = await page.request.get(`/api/v1/questions/bank-categories/${CATEGORY}`);
  expect(trongKho.ok(), `đọc lại kho thất bại: ${await trongKho.text()}`).toBe(true);
  // API bọc mọi phản hồi trong { success, data } — đọc thẳng là được undefined.
  const { data } = (await trongKho.json()) as {
    data: { folders: { name: string; questions: { content: string; type: string }[] }[] };
  };
  const thuMuc = data.folders.find((f) => f.name === nhan);
  expect(thuMuc, 'thư mục khai trong tệp phải được tạo').toBeTruthy();
  expect(thuMuc!.questions).toHaveLength(2);
  expect(thuMuc!.questions.map((q) => q.type).sort()).toEqual([
    'MULTIPLE_CHOICE_SINGLE',
    'SHORT_ANSWER',
  ]);
  // Công thức được lưu dưới dạng mã nguồn, không phải chữ suông.
  expect(thuMuc!.questions.some((q) => q.content.includes('frac'))).toBe(true);

  expect(loi, 'không được có lỗi JS').toEqual([]);
});
