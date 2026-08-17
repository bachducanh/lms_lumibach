import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { BankCategoryList } from '@/components/features/courses/BankCategoryList';
import type { ManageableBankCategory } from '@lumibach/types';
import type { UserRole } from '@lumibach/db';

export const metadata = { title: 'Ngân hàng chung' };
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

  const tongCauHoi = categories.reduce((s, c) => s + c.questionCount, 0);
  const tongChuong = categories.reduce((s, c) => s + c.moduleCount, 0);

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-muted-foreground/70 font-mono text-[11px] tracking-[0.18em] uppercase">
          Ngân hàng chung
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Soạn một lần, mọi lớp dùng lại</h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Nội dung ở đây không thuộc lớp nào. Nó gắn vào một tầng của cây danh mục và mọi lớp bên
          dưới tầng đó đều chép về được — kể cả những lớp mở ở năm học sau.
        </p>
        {categories.length > 0 && (
          <p className="text-muted-foreground/70 font-mono text-[11px]">
            {categories.length} danh mục · {tongCauHoi} câu hỏi · {tongChuong} chương
          </p>
        )}
      </header>

      {categories.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm font-medium">Chưa có danh mục nào bạn soạn được kho</p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">
            Kho mở theo đường dẫn danh mục của khoá bạn đang quản lý. Nhờ Quản trị viên xếp khoá vào
            đúng danh mục, kho sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <BankCategoryList categories={categories} />
      )}
    </div>
  );
}
