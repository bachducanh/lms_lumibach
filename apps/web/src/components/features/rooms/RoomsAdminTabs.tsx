'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardCheck, DoorOpen, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/rooms', label: 'Quản lý phòng', icon: DoorOpen },
  { href: '/admin/rooms/bookings', label: 'Duyệt mượn phòng', icon: ClipboardCheck },
  { href: '/admin/rooms/equipment-bookings', label: 'Duyệt mượn thiết bị', icon: PackageCheck },
  { href: '/admin/rooms/reports', label: 'Báo cáo', icon: BarChart3 },
] as const;

export function RoomsAdminTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border flex w-full gap-1 overflow-x-auto border-b"
      aria-label="Phòng chức năng"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
