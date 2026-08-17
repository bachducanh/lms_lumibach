import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as Minio from 'minio';
import { KNOWN_BUCKETS, toStoragePath } from './storage-url';

// Chỉ cho phép xoá object nằm trong 2 bucket của hệ thống — danh sách khai báo
// một chỗ duy nhất ở storage-url.ts để không lệch nhau.

type ParsedObject = { bucket: string; objectName: string };

/**
 * Dọn file vật lý trên MinIO khi bản ghi DB bị xoá.
 *
 * Nguyên tắc: LUÔN xoá DB trước, gọi service này sau. Mọi lỗi ở đây đều được
 * nuốt và ghi log — file mồ côi thì vô hại, còn ném lỗi sẽ làm hỏng một thao
 * tác xoá đã thành công ở phía DB.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client | null;

  constructor() {
    if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
      this.client = null;
      return;
    }
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_INTERNAL_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_INTERNAL_PORT ?? process.env.MINIO_PORT ?? '9000', 10),
      useSSL: false, // kết nối nội bộ luôn là HTTP thuần
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }

  /**
   * Tách URL đã lưu trong DB thành { bucket, objectName }.
   *
   * Chuẩn hoá qua `toStoragePath` chứ KHÔNG tự dò chuỗi `/storage/`. Từ khi bật
   * miền media, `getPublicUrl` sinh ra `<media>/<bucket>/<object>` — không còn
   * đoạn `/storage/` nào để dò. Bản cũ tự dò nên trả null cho mọi file tải lên
   * sau khi bật miền, và vì null ở đây nghĩa là "không phải file của mình" nên
   * hỏng trong im lặng: chép file bỏ qua đính kèm, chép PDF đề luyện tập ném
   * lỗi, và dọn rác không xoá gì nên file nằm lại MinIO mãi mãi.
   *
   * `toStoragePath` cũng vá một lỗ của bản cũ: `new URL(url).pathname` nhận
   * `https://evil.com/storage/<bucket>/<object>` thành object của CHÍNH MÌNH,
   * nên ai chèn được URL vào nội dung là khiến `removeByUrls` xoá file thật.
   *
   * Trả null nếu không nhận dạng được hoặc bucket lạ — thà bỏ sót file rác còn
   * hơn xoá nhầm object của dự án khác trên cùng máy MinIO.
   */
  parseUrl(url: string | null | undefined): ParsedObject | null {
    if (!url) return null;

    const path = toStoragePath(url);
    if (!path) return null;

    const rest = path.slice('/storage/'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;

    const bucket = decodeURIComponent(rest.slice(0, slash));
    const objectName = decodeURIComponent(rest.slice(slash + 1));
    if (!objectName || !KNOWN_BUCKETS.has(bucket)) return null;

    return { bucket, objectName };
  }

  /**
   * Gom URL file trong nội dung rich-text (ảnh chèn qua editor).
   *
   * Đây là dữ liệu do người dùng soạn nên phải kiểm origin. Nếu chỉ dò chuỗi
   * `/storage/` thì `<img src="https://evil.com/storage/<bucket>/<object>">` cũng
   * khớp, và khi dọn rác sẽ xoá đúng object đó trên MinIO của mình — tức là ai
   * soạn được nội dung cũng xoá được file của người khác.
   *
   * Kết quả luôn được quy về dạng `/storage/…`. Nhờ vậy phép so `content contains
   * <url>` ở LessonCleanupService khớp được cả nội dung lưu URL tuyệt đối (miền
   * media) lẫn nội dung cũ lưu đường dẫn tương đối.
   */
  extractUrlsFromHtml(html: string | null | undefined): string[] {
    if (!html) return [];
    // Bắt trọn URL tuyệt đối (để còn kiểm origin) HOẶC đường dẫn /storage/ tương
    // đối, rồi để toStoragePath lọc — nó biết mọi dạng URL hợp lệ của hệ thống và
    // loại bỏ host lạ. Trên miền media, URL không còn chứa "/storage/" nên không
    // thể chỉ dò chuỗi đó nữa.
    const matches = html.match(/https?:\/\/[^\s"'()<>\\]+|\/storage\/[^\s"'()<>\\]+/g);
    if (!matches) return [];
    const paths = matches.map((m) => toStoragePath(m)).filter((p): p is string => p !== null);
    return [...new Set(paths)];
  }

  /**
   * Xoá các object tương ứng với danh sách URL. Bỏ qua null/URL không hợp lệ.
   * Trả về số object đã xoá thành công.
   */
  async removeByUrls(urls: (string | null | undefined)[]): Promise<number> {
    if (!this.client) return 0;

    // Gom theo bucket và khử trùng lặp để gọi removeObjects theo lô.
    const byBucket = new Map<string, Set<string>>();
    for (const url of urls) {
      const parsed = this.parseUrl(url);
      if (!parsed) continue;
      const set = byBucket.get(parsed.bucket) ?? new Set<string>();
      set.add(parsed.objectName);
      byBucket.set(parsed.bucket, set);
    }
    if (byBucket.size === 0) return 0;

    let removed = 0;
    for (const [bucket, objects] of byBucket) {
      const names = [...objects];
      try {
        await this.client.removeObjects(bucket, names);
        removed += names.length;
      } catch (err) {
        this.logger.warn(
          `Không xoá được ${names.length} file trong bucket "${bucket}": ${String(err)}`
        );
      }
    }
    return removed;
  }

  async getObject(bucket: string, objectName: string) {
    if (!this.client) {
      throw new ServiceUnavailableException('Storage chưa được cấu hình.');
    }
    return this.client.getObject(bucket, objectName);
  }

  /**
   * Nhân bản một object sang key mới trong cùng bucket, trả về URL của bản sao.
   *
   * Dùng khi sao chép hoạt động sang khoá học khác. KHÔNG dùng chung một object
   * cho hai bản ghi: lúc xoá bản này, StorageService sẽ gỡ file khỏi MinIO và
   * làm hỏng luôn bản kia — bản ghi vẫn còn nhưng file thì mất.
   *
   * Trả `null` (kèm log) nếu URL không thuộc storage của mình, storage chưa cấu
   * hình, hoặc copy hỏng. Bên gọi tự quyết định: bỏ file hay huỷ cả thao tác.
   */
  async copyByUrl(url: string | null | undefined, keyPrefix: string): Promise<string | null> {
    const parsed = this.parseUrl(url);
    if (!parsed || !this.client) return null;

    // Giữ nguyên phần đuôi mở rộng để trình duyệt đoán đúng kiểu file.
    const dot = parsed.objectName.lastIndexOf('.');
    const ext = dot > -1 ? parsed.objectName.slice(dot) : '';
    const target = `${keyPrefix}/${randomUUID()}${ext}`;

    try {
      await this.client.copyObject(parsed.bucket, target, `/${parsed.bucket}/${parsed.objectName}`);
      return `/storage/${parsed.bucket}/${target}`;
    } catch (err) {
      this.logger.warn(`Không nhân bản được file "${parsed.objectName}": ${String(err)}`);
      return null;
    }
  }
}
