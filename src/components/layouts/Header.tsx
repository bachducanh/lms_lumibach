import { ThemeToggle } from '@/components/layouts/ThemeToggle';
import { UserMenu } from '@/components/features/auth/UserMenu';

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card/80 backdrop-blur-sm px-6 gap-3">
      <div className="flex-1" />
      <ThemeToggle />
      <div className="h-5 w-px bg-border" />
      <UserMenu />
    </header>
  );
}
