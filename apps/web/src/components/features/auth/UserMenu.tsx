'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, User } from 'lucide-react';

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị',
  TEACHER: 'Giáo viên',
  TA: 'Trợ giảng',
  STUDENT: 'Học sinh',
};

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user) return null;

  const { user } = session;
  const initials = user.name
    ? user.name
        .split(' ')
        .slice(-2)
        .map((n) => (n[0] ?? '').toUpperCase())
        .join('')
    : (user.email?.[0]?.toUpperCase() ?? '?');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors outline-none">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm leading-none font-medium">{user.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-none">{user.email}</p>
              <Badge variant="secondary" className="mt-1.5 w-fit text-xs">
                {roleLabel[user.role] ?? user.role}
              </Badge>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <User className="mr-2 h-4 w-4" />
          Hồ sơ cá nhân
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings/security')}>
          <Settings className="mr-2 h-4 w-4" />
          Đổi mật khẩu
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: '/login' })}>
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
