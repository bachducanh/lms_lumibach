import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ProfileForm } from '@/components/features/users/ProfileForm';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
      role: true,
      status: true,
      avatar: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) redirect('/login');

  return (
    <div className="lb-stagger mx-auto max-w-lg space-y-6">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="text-2xl font-bold">Hồ sơ của tôi</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <div style={{ ['--i' as string]: 1 }}>
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
