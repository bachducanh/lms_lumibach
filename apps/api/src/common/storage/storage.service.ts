import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

// Cấu hình phải khớp apps/web/src/lib/storage.ts — cùng trỏ vào một MinIO.
const BUCKET_AVATARS = process.env.MINIO_BUCKET_AVATARS ?? 'lumibach-avatars';
const BUCKET_FILES = process.env.MINIO_BUCKET_FILES ?? 'lumibach-files';

// Chỉ cho phép xoá object nằm trong 2 bucket của hệ thống.
const KNOWN_BUCKETS = new Set([BUCKET_AVATARS, BUCKET_FILES]);

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
   * Dạng chuẩn hiện tại là URL tương đối `/storage/<bucket>/<object>` (xem
   * getPublicUrl ở web). Cũng chấp nhận URL tuyệt đối có chứa `/storage/` cho
   * dữ liệu cũ. Trả null nếu không nhận dạng được hoặc bucket lạ — thà bỏ sót
   * file rác còn hơn xoá nhầm object không thuộc hệ thống.
   */
  parseUrl(url: string | null | undefined): ParsedObject | null {
    if (!url) return null;

    let path = url;
    if (/^https?:\/\//i.test(url)) {
      try {
        path = new URL(url).pathname;
      } catch {
        return null;
      }
    }

    const marker = '/storage/';
    const at = path.indexOf(marker);
    if (at === -1) return null;

    const rest = path.slice(at + marker.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;

    const bucket = decodeURIComponent(rest.slice(0, slash));
    const objectName = decodeURIComponent(rest.slice(slash + 1));
    if (!objectName || !KNOWN_BUCKETS.has(bucket)) return null;

    return { bucket, objectName };
  }

  /** Gom nhiều URL trong nội dung rich-text (ảnh chèn qua editor). */
  extractUrlsFromHtml(html: string | null | undefined): string[] {
    if (!html) return [];
    const matches = html.match(/\/storage\/[^\s"'()<>\\]+/g);
    return matches ? [...new Set(matches)] : [];
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
}
