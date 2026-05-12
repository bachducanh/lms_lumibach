import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { EditUserForm } from '@/components/features/users/EditUserForm';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
      status: true,
      phone: true,
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chỉnh sửa tài khoản</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <EditUserForm user={user} />
    </div>
  );
}
