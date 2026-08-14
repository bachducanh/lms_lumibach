import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import type { ManageableBankCategory } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';
import { ChevronRight, Library } from 'lucide-react';

export const metadata = { title: 'Ngân hàng câu hỏi chung' };
export const dynamic = 'force-dynamic';

export default async function QuestionBanksPage() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  // Kho là nội dung dùng chung nhiều lớp — trợ giảng không soạn.
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const categories = await api
    .get<ManageableBankCategory[]>('/questions/bank-categories')
    .catch(() => [] as ManageableBankCategory[]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Library className="text-primary h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ngân hàng câu hỏi chung</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Soạn câu hỏi và nội dung thẳng vào danh mục khoá học. Những gì ở đây không thuộc lớp nào
            — mọi lớp trong nhánh danh mục đều chép về được, và kho vẫn còn khi lớp kết thúc.
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-14 text-center text-sm">
          Chưa có danh mục nào bạn được soạn kho. Kho mở theo đường dẫn danh mục của khoá bạn đang
          quản lý — nhờ Quản trị viên xếp khoá vào đúng danh mục trước.
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/question-banks/${c.id}`}
                className="border-border bg-card hover:bg-accent/30 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.path}</p>
                  <p className="text-muted-foreground text-xs">
                    {c.questionCount} câu hỏi · {c.moduleCount} chương nội dung
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground/40 h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
