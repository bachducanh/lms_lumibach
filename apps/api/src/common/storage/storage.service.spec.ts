import { describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';

// Bucket được suy ra từ env đúng như storage.service.ts, để spec không vỡ khi
// .env.test đặt tên bucket riêng.
const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';
const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';

const service = new StorageService();

describe('StorageService.parseUrl', () => {
  it('tách được URL tương đối dạng /storage/<bucket>/<object>', () => {
    expect(service.parseUrl(`/storage/${BUCKET_FILES}/submissions/asg1/user1/abc.pdf`)).toEqual({
      bucket: BUCKET_FILES,
      objectName: 'submissions/asg1/user1/abc.pdf',
    });
  });

  it('tách được URL tuyệt đối của dữ liệu cũ', () => {
    expect(service.parseUrl(`https://lumi.example.com/storage/${BUCKET_AVATARS}/u1/a.png`)).toEqual(
      {
        bucket: BUCKET_AVATARS,
        objectName: 'u1/a.png',
      }
    );
  });

  it('tách được URL trên miền media (giữ nguyên đoạn /storage/)', () => {
    expect(
      service.parseUrl(`https://media.lumibach.com/storage/${BUCKET_FILES}/submissions/a/b.pdf`)
    ).toEqual({ bucket: BUCKET_FILES, objectName: 'submissions/a/b.pdf' });
  });

  it('giải mã ký tự đã encode trong tên object', () => {
    expect(
      service.parseUrl(`/storage/${BUCKET_FILES}/lesson-attachments/l1/b%C3%A0i%201.pdf`)
    ).toEqual({ bucket: BUCKET_FILES, objectName: 'lesson-attachments/l1/bài 1.pdf' });
  });

  // Nhóm dưới đây là hàng rào an toàn: parseUrl trả null nghĩa là KHÔNG xoá gì.
  // Thà bỏ sót file rác còn hơn xoá nhầm object không thuộc hệ thống.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chuỗi rỗng', ''],
    ['không có /storage/', '/uploads/lumibach-files/a.png'],
    ['bucket lạ', '/storage/some-other-bucket/a.png'],
    ['thiếu tên object', `/storage/${BUCKET_FILES}/`],
    ['chỉ có bucket', `/storage/${BUCKET_FILES}`],
    ['bucket rỗng', '/storage//a.png'],
    ['URL tuyệt đối hỏng', 'http://['],
  ])('trả null khi %s', (_label, input) => {
    expect(service.parseUrl(input)).toBeNull();
  });
});

describe('StorageService.extractUrlsFromHtml', () => {
  it('lấy được URL ảnh trong nội dung và khử trùng lặp', () => {
    const html = [
      `<p>Xem ảnh</p>`,
      `<img src="/storage/${BUCKET_FILES}/editor-images/u1/a.png" />`,
      `<img src="/storage/${BUCKET_FILES}/editor-images/u1/a.png" />`,
      `<img src="/storage/${BUCKET_FILES}/editor-images/u1/b.png" />`,
    ].join('');

    expect(service.extractUrlsFromHtml(html)).toEqual([
      `/storage/${BUCKET_FILES}/editor-images/u1/a.png`,
      `/storage/${BUCKET_FILES}/editor-images/u1/b.png`,
    ]);
  });

  it('trả mảng rỗng khi nội dung trống hoặc không có file', () => {
    expect(service.extractUrlsFromHtml('')).toEqual([]);
    expect(service.extractUrlsFromHtml(null)).toEqual([]);
    expect(service.extractUrlsFromHtml('<p>Không có ảnh</p>')).toEqual([]);
  });

  // Nội dung rich-text do người dùng soạn. Nếu chỉ dò chuỗi "/storage/" thì kẻ
  // soạn nội dung chèn được URL host lạ và làm hệ thống xoá file của người khác.
  it('bỏ qua URL của host lạ dù bên trong có chứa /storage/', () => {
    const html = [
      `<img src="/storage/${BUCKET_FILES}/editor-images/u1/ok.png" />`,
      `<img src="https://evil.com/storage/${BUCKET_AVATARS}/victim/avatar.png" />`,
      `<img src="https://evil.com/x?y=/storage/${BUCKET_FILES}/editor-images/u2/b.png" />`,
      `<a href="https://media.lumibach.com.evil.com/storage/${BUCKET_FILES}/c.png">x</a>`,
    ].join('');

    expect(service.extractUrlsFromHtml(html)).toEqual([
      `/storage/${BUCKET_FILES}/editor-images/u1/ok.png`,
    ]);
  });
});

describe('StorageService.removeByUrls', () => {
  it('không ném lỗi và trả 0 khi MinIO chưa được cấu hình', async () => {
    await expect(service.removeByUrls([`/storage/${BUCKET_FILES}/a.png`])).resolves.toBe(0);
  });
});
