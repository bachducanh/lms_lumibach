import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { BankForumForm } from '@/components/features/courses/BankForumForm';
import { buttonVariants } from '@/components/ui/button';
import { bankContentHref } from '@/lib/activity-owner';
import type { UserRole } from '@lumibach/db';
import { ArrowLeft, MessagesSquare } from 'lucide-react';

export const metadata = { title: 'Sửa diễn đàn trong kho' };
export const dynamic = 'force-dynamic';

type BankForum = {
  id: string;
  bankCategoryId: string;
  title: string;
  description: string | null;
};

export default async function EditBankForumPage({
  params,
}: {
  params: Promise<{ categoryId: string; forumId: string }>;
}) {
  const { categoryId, forumId } = await params;

  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TEACHER')) redirect('/dashboard');

  const api = apiServerClient(await cookies());
  const forum = await api.get<BankForum>(`/forum/bank-forums/${forumId}`).catch(() => null);
  if (!forum || forum.bankCategoryId !== categoryId) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={bankContentHref(categoryId)}
          className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-sky-400" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{forum.title}</h1>
            <p className="text-muted-foreground text-xs">Bản mẫu trong kho nội dung</p>
          </div>
        </div>
      </div>

      <BankForumForm categoryId={categoryId} forum={forum} />
    </div>
  );
}
