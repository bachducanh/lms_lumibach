import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { taoTepMau } from '@/lib/word-import/tao-tep-mau';
import type { UserRole } from '@lumibach/db';

/**
 * Tải tệp Word mẫu cho việc nhập đề.
 *
 * Sinh tại chỗ thay vì phục vụ một tệp nhị phân có sẵn, để mẫu luôn khớp với
 * quy ước mà bộ đọc đang dùng.
 */
export async function GET() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user?.id) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  if (!hasMinRole(role, 'TEACHER'))
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const buffer = await taoTepMau();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="mau-nhap-de.docx"',
      'Cache-Control': 'no-store',
    },
  });
}
