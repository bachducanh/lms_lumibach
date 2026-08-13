import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { apiServerClient } from '@/lib/api-client';
import { hasMinRole } from '@/lib/permissions';
import { ProfileForm } from '@/components/features/users/ProfileForm';
import { LearningPortfolioOverview } from '@/components/features/portfolio/LearningPortfolioOverview';
import { StaffProfileCard } from '@/components/features/rooms/StaffProfileCard';
import type { PortfolioOverview, StaffProfileDto } from '@lumibach/types';

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

  const api = apiServerClient(await cookies());
  const portfolio =
    user.role === 'STUDENT'
      ? await api.get<PortfolioOverview>('/portfolio/me/overview').catch(() => null)
      : null;

  // Hồ sơ công tác chỉ liên quan tới người dùng được phép mượn phòng chức năng.
  const staffProfile = hasMinRole(user.role, 'TA')
    ? await api.get<StaffProfileDto>('/staff-profile').catch(() => null)
    : null;

  return (
    <div className="lb-stagger mx-auto max-w-5xl space-y-6">
      <div style={{ ['--i' as string]: 0 }}>
        <h1 className="text-2xl font-bold">Hồ sơ của tôi</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <div
        className={portfolio ? 'grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]' : 'max-w-lg'}
        style={{ ['--i' as string]: 1 }}
      >
        <div className="space-y-6">
          <ProfileForm user={user} />
          {staffProfile && <StaffProfileCard profile={staffProfile} />}
        </div>
        {portfolio && <LearningPortfolioOverview overview={portfolio} />}
      </div>
    </div>
  );
}
