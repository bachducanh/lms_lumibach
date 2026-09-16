import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/auth';
import {
  minioClient,
  BUCKET_FILES,
  ensureBucket,
  getPublicUrl,
  isMinioConfigured,
} from '@/lib/storage';
import { hasMinRole } from '@/lib/permissions';
import { docDocx } from '@/lib/word-import/docx-to-lines';
import type { UserRole } from '@lumibach/db';

/**
 * Đọc tệp đề Word thành danh sách dòng cho màn hình xem trước.
 *
 * Đặt ở máy chủ chứ không ở trình duyệt vì bộ đổi công thức Office cần bản DOM
 * của Node, và vì ảnh trong đề phải được đẩy thẳng lên kho tệp thay vì đi vòng
 * qua chuỗi base64 khổng lồ.
 *
 * Route này KHÔNG ghi gì vào cơ sở dữ liệu. Câu hỏi chỉ được tạo khi giáo viên
 * xem lại rồi bấm nhập ở bước sau.
 */

const MAX_SIZE = 25 * 1024 * 1024;
const DUOI_ANH: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;

  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!hasMinRole(role, 'TEACHER'))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Chưa chọn tệp' }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Tệp tối đa 25 MB' }, { status: 400 });
  if (!/\.docx$/i.test(file.name)) {
    return NextResponse.json(
      { error: 'Chỉ nhận tệp .docx. Tệp .doc cũ cần mở bằng Word rồi lưu lại dạng .docx.' },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Kho tệp chỉ đụng tới khi tệp đề THỰC SỰ có ảnh. Đề toàn chữ và công thức là
  // trường hợp phổ biến nhất, và nó không có lý do gì phải hỏng theo chỉ vì kho
  // ảnh đang chết. Ảnh hỏng được đếm lại và báo trên màn hình xem trước.
  let daTaoBucket = false;
  try {
    const ketQua = await docDocx(await file.arrayBuffer(), async (data, contentType) => {
      if (!isMinioConfigured()) throw new Error('Kho tệp chưa được cấu hình');
      if (!daTaoBucket) {
        await ensureBucket(BUCKET_FILES);
        daTaoBucket = true;
      }
      const ext = DUOI_ANH[contentType] ?? 'png';
      const objectName = `editor-images/${userId}/${randomBytes(8).toString('hex')}.${ext}`;
      await minioClient.putObject(BUCKET_FILES, objectName, data, data.length, {
        'Content-Type': contentType,
      });
      return getPublicUrl(BUCKET_FILES, objectName);
    });

    return NextResponse.json(ketQua);
  } catch (err) {
    console.error('[WORD IMPORT]', err);
    return NextResponse.json(
      { error: 'Không đọc được tệp. Hãy kiểm tra lại tệp có đúng là .docx không.' },
      { status: 400 }
    );
  }
}
