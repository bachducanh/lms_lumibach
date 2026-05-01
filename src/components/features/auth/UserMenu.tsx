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
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent transition-colors outline-none cursor-pointer">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-sm leading-none">{user.name}</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">{user.email}</p>
              <Badge variant="secondary" className="w-fit mt-1.5 text-xs">
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
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
