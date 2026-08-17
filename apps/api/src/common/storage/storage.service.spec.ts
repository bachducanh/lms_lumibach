import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * `parseUrl` là cửa duy nhất từ "URL đã lưu trong DB" sang "object trên MinIO".
 * Trả null nghĩa là "không phải file của mình", và mọi nhánh dùng nó đều hỏng
 * TRONG IM LẶNG khi đó: chép file đính kèm bị bỏ qua, chép PDF đề luyện tập ném
 * lỗi, dọn file rác không xoá gì.
 *
 * Bài kiểm này tồn tại vì một lỗi thật: bản cũ tự dò chuỗi `/storage/` nên hỏng
 * với đúng dạng URL mà production sinh ra sau khi bật miền media
 * (`<media>/<bucket>/<object>` — không còn đoạn `/storage/` nào để dò). Ở hồ sơ
 * dev thì NEXT_PUBLIC_MEDIA_URL để trống nên URL vẫn có `/storage/` và lỗi
 * không bao giờ lộ ra khi chạy local.
 *
 * Module đọc env lúc import nên phải nạp lại sau khi đặt biến.
 */
const MEDIA = 'https://media.lumibach.com';

async function taoService(mediaUrl: string) {
  process.env.NEXT_PUBLIC_MEDIA_URL = mediaUrl;
  // storage-url.ts đọc env ở thời điểm import, nên phải xoá registry để lần
  // import sau đánh giá lại module với giá trị mới.
  vi.resetModules();
  const mod = await import('./storage.service');
  return new mod.StorageService();
}

describe('StorageService.parseUrl', () => {
  const envCu = process.env.NEXT_PUBLIC_MEDIA_URL;

  beforeEach(() => {
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MEDIA_URL = envCu;
  });

  it('nhận URL dạng miền media — dạng production sinh ra hiện nay', async () => {
    const svc = await taoService(MEDIA);
    expect(svc.parseUrl(`${MEDIA}/lumibach-files/practice-tests/abc/de.pdf`)).toEqual({
      bucket: 'lumibach-files',
      objectName: 'practice-tests/abc/de.pdf',
    });
  });

  it('vẫn nhận URL tương đối — dạng khi chưa bật miền media', async () => {
    const svc = await taoService('');
    expect(svc.parseUrl('/storage/lumibach-files/lesson-files/x.docx')).toEqual({
      bucket: 'lumibach-files',
      objectName: 'lesson-files/x.docx',
    });
  });

  it('vẫn nhận URL tuyệt đối dạng cũ có tiền tố /storage/', async () => {
    const svc = await taoService(MEDIA);
    expect(svc.parseUrl(`${MEDIA}/storage/lumibach-avatars/u/1.png`)).toEqual({
      bucket: 'lumibach-avatars',
      objectName: 'u/1.png',
    });
  });

  it('từ chối bucket của dự án khác trên cùng máy MinIO', async () => {
    const svc = await taoService(MEDIA);
    expect(svc.parseUrl(`${MEDIA}/du-an-khac/secret.pdf`)).toBeNull();
  });

  it('từ chối miền lạ dù đường dẫn trông giống storage của mình', async () => {
    const svc = await taoService(MEDIA);
    expect(svc.parseUrl('https://evil.com/storage/lumibach-files/x.pdf')).toBeNull();
  });

  it('từ chối URL rỗng hoặc thiếu tên object', async () => {
    const svc = await taoService(MEDIA);
    expect(svc.parseUrl(null)).toBeNull();
    expect(svc.parseUrl('')).toBeNull();
    expect(svc.parseUrl(`${MEDIA}/lumibach-files/`)).toBeNull();
  });
});
