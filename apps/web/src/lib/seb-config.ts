// Đọc/ghi file cấu hình Safe Exam Browser (.seb).
//
// File .seb là một property list (XML) của Apple, được SEB lưu ở ba dạng:
//   1. XML thuần (Config Tool → "Save Settings As…" khi không đặt mật khẩu file)
//   2. gzip của XML đó
//   3. 4 byte header ("plnd", "pswd", "pkhs"…) + gzip — dạng mặc định
// Dạng đặt mật khẩu thì nội dung đã mã hoá, không sửa được — khi đó trả về null
// để nơi gọi rơi về dùng nguyên file gốc.

import { gunzipSync, gzipSync } from 'node:zlib';

type SebEnvelope = {
  xml: string;
  /** Đóng gói lại đúng dạng ban đầu để SEB đọc được. */
  repack: (xml: string) => Buffer;
};

const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(buf: Buffer, offset = 0): boolean {
  return buf[offset] === GZIP_MAGIC[0] && buf[offset + 1] === GZIP_MAGIC[1];
}

/** Bóc file .seb ra XML; trả null nếu file được mã hoá bằng mật khẩu. */
export function unpackSebConfig(raw: Buffer): SebEnvelope | null {
  if (raw.subarray(0, 5).toString('ascii') === '<?xml') {
    return { xml: raw.toString('utf8'), repack: (xml) => Buffer.from(xml, 'utf8') };
  }

  if (isGzip(raw)) {
    try {
      return {
        xml: gunzipSync(raw).toString('utf8'),
        repack: (xml) => gzipSync(Buffer.from(xml, 'utf8')),
      };
    } catch {
      return null;
    }
  }

  // 4 byte header + gzip
  if (raw.length > 4 && isGzip(raw, 4)) {
    const header = raw.subarray(0, 4);
    try {
      return {
        xml: gunzipSync(raw.subarray(4)).toString('utf8'),
        repack: (xml) => Buffer.concat([header, gzipSync(Buffer.from(xml, 'utf8'))]),
      };
    } catch {
      return null;
    }
  }

  return null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape để nhúng một origin vào regex của bộ lọc URL trong file .seb. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readStringValue(xml: string, key: string): string | null {
  const m = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`));
  return m?.[1] ?? null;
}

function setStringValue(xml: string, key: string, value: string): string {
  // `<string />` (rỗng) và `<string>…</string>` đều phải khớp.
  const re = new RegExp(`(<key>${key}</key>\\s*)(?:<string\\s*/>|<string>[\\s\\S]*?</string>)`);
  if (!re.test(xml)) return xml;
  return xml.replace(re, `$1<string>${escapeXml(value)}</string>`);
}

function isTrue(xml: string, key: string): boolean {
  return new RegExp(`<key>${key}</key>\\s*<true\\s*/>`).test(xml);
}

/**
 * Bảo đảm origin của LMS nằm trong whitelist của bộ lọc URL.
 *
 * SEB Configuration Tool sinh regex sai khi URL có kèm đường dẫn (nó ghép thành
 * `domain\//path`, đòi hai dấu gạch chéo) nên rất dễ xảy ra cảnh SEB chặn luôn
 * trang khởi động. Ta chủ động chèn một luật cho phép chính origin của hệ thống —
 * thiếu nó thì bài thi không thể chạy.
 */
function ensureOriginWhitelisted(xml: string, origin: string): string {
  if (!isTrue(xml, 'URLFilterEnable')) return xml;

  const rule = `^${escapeRegex(origin)}(\\/.*)?$`;
  const current = readStringValue(xml, 'whitelistURLFilter') ?? '';
  if (current.split(';').includes(rule)) return xml;

  const merged = current ? `${rule};${current}` : rule;
  let next = setStringValue(xml, 'whitelistURLFilter', merged);

  // URLFilterRules là danh sách Config Tool hiển thị; giữ cho khớp với whitelist.
  const rulesRe = /(<key>URLFilterRules<\/key>\s*<array>)/;
  if (rulesRe.test(next)) {
    const entry = `
      <dict>
        <key>active</key>
        <true />
        <key>regex</key>
        <true />
        <key>expression</key>
        <string>${escapeXml(rule)}</string>
        <key>action</key>
        <integer>1</integer>
      </dict>`;
    next = next.replace(rulesRe, `$1${entry}`);
  }

  return next;
}

/**
 * Ghi đè `startURL` của file cấu hình để SEB mở thẳng vào hoạt động, đồng thời
 * mở whitelist cho origin của LMS. Trả về null khi file mã hoá / không đọc được.
 */
export function withSebStartUrl(raw: Buffer, startUrl: string, origin: string): Buffer | null {
  const envelope = unpackSebConfig(raw);
  if (!envelope) return null;

  const hasStartUrl = /<key>startURL<\/key>/.test(envelope.xml);
  let xml = hasStartUrl
    ? setStringValue(envelope.xml, 'startURL', startUrl)
    : // Không có key startURL trong file (hiếm) → chèn ngay đầu dict gốc.
      envelope.xml.replace(
        /(<dict>)/,
        `$1\n    <key>startURL</key>\n    <string>${escapeXml(startUrl)}</string>`
      );
  xml = ensureOriginWhitelisted(xml, origin);

  return envelope.repack(xml);
}
