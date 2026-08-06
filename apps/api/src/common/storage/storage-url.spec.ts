import { afterEach, describe, expect, it, vi } from 'vitest';

const MEDIA = 'https://media.lumibach.com';
const APP = 'https://lumibach.com';
const ORIGINAL_MEDIA = process.env.NEXT_PUBLIC_MEDIA_URL;
const ORIGINAL_APP = process.env.NEXT_PUBLIC_APP_URL;

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

/** storage-url.ts đọc env lúc import nên phải nạp lại module cho từng cấu hình. */
async function load(mediaBase: string | undefined, appBase?: string) {
  vi.resetModules();
  setEnv('NEXT_PUBLIC_MEDIA_URL', mediaBase);
  setEnv('NEXT_PUBLIC_APP_URL', appBase);
  return import('./storage-url');
}

afterEach(() => {
  setEnv('NEXT_PUBLIC_MEDIA_URL', ORIGINAL_MEDIA);
  setEnv('NEXT_PUBLIC_APP_URL', ORIGINAL_APP);
});

describe('toStoragePath — khi chưa bật miền media', () => {
  it('giữ nguyên đường dẫn tương đối', async () => {
    const { toStoragePath } = await load(undefined);
    expect(toStoragePath('/storage/lumibach-files/a.pdf')).toBe('/storage/lumibach-files/a.pdf');
  });

  it('từ chối URL tuyệt đối vì chưa cấu hình miền nào được tin', async () => {
    const { toStoragePath } = await load(undefined);
    expect(toStoragePath(`${MEDIA}/storage/lumibach-files/a.pdf`)).toBeNull();
  });
});

describe('toStoragePath — khi đã bật miền media', () => {
  it('quy URL trên miền media về đường dẫn /storage/…', async () => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath(`${MEDIA}/storage/lumibach-files/submissions/a/b/c.pdf`)).toBe(
      '/storage/lumibach-files/submissions/a/b/c.pdf'
    );
  });

  it('vẫn nhận đường dẫn tương đối của dữ liệu cũ', async () => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath('/storage/lumibach-avatars/u1/a.png')).toBe(
      '/storage/lumibach-avatars/u1/a.png'
    );
  });

  it('bỏ qua dấu / thừa ở cuối biến môi trường', async () => {
    const { toStoragePath } = await load(`${MEDIA}/`);
    expect(toStoragePath(`${MEDIA}/storage/lumibach-files/a.pdf`)).toBe(
      '/storage/lumibach-files/a.pdf'
    );
  });
});

describe('toStoragePath — dạng URL hiện hành trên miền media', () => {
  it('nhận <media>/<bucket>/<object> và quy về /storage/…', async () => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath(`${MEDIA}/lumibach-files/submissions/a/b/c.pdf`)).toBe(
      '/storage/lumibach-files/submissions/a/b/c.pdf'
    );
  });

  it('vẫn nhận dạng cũ có tiền tố /storage/', async () => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath(`${MEDIA}/storage/lumibach-avatars/u1/a.png`)).toBe(
      '/storage/lumibach-avatars/u1/a.png'
    );
  });

  // Máy MinIO đang dùng chung với nhiều dự án khác (ielts-docs, canvas-production…).
  // Không kiểm tên bucket thì một URL bịa ra sẽ đọc/xoá được file của dự án khác.
  it.each([
    ['bucket của dự án khác', `${MEDIA}/ielts-docs/de-thi.pdf`],
    ['bucket lạ', `${MEDIA}/khong-ton-tai/a.png`],
    ['thiếu tên object', `${MEDIA}/lumibach-files/`],
    ['chỉ có bucket', `${MEDIA}/lumibach-files`],
  ])('trả null với %s', async (_label, input) => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath(input)).toBeNull();
  });
});

describe('toStoragePath — miền của web cũng được tin', () => {
  it('nhận URL tuyệt đối trỏ về chính miền web (đi qua rewrite /storage/*)', async () => {
    const { toStoragePath } = await load(MEDIA, APP);
    expect(toStoragePath(`${APP}/storage/lumibach-files/a.pdf`)).toBe(
      '/storage/lumibach-files/a.pdf'
    );
  });

  it('vẫn từ chối host lạ khi đã cấu hình cả hai miền', async () => {
    const { toStoragePath } = await load(MEDIA, APP);
    expect(toStoragePath('https://evil.com/storage/lumibach-files/a.pdf')).toBeNull();
  });
});

// Đây là lý do tồn tại của hàm: chặn URL do client bịa ra. Nếu dùng
// `new URL(url).pathname` thì mọi ca dưới đây đều lọt.
describe('toStoragePath — hàng rào an toàn', () => {
  it.each([
    ['host hoàn toàn khác', 'https://evil.com/storage/lumibach-files/a.pdf'],
    ['host ăn theo tiền tố', 'https://media.lumibach.com.evil.com/storage/lumibach-files/a.pdf'],
    ['media nằm ở query', 'https://evil.com/?x=https://media.lumibach.com/storage/f/a.pdf'],
    ['giao thức javascript', 'javascript:alert(1)'],
    ['đường dẫn không thuộc storage', '/uploads/lumibach-files/a.pdf'],
    ['chuỗi rỗng', ''],
  ])('trả null với %s', async (_label, input) => {
    const { toStoragePath } = await load(MEDIA);
    expect(toStoragePath(input)).toBeNull();
  });
});
