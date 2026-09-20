import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Logo LumiBach: khối lập phương (icon.png) + tên chữ. Ảnh logo có nền trắng nên
 * trên nền tối được đặt trong ô trắng bo góc thay vì để lộ viền.
 */
export function LumiLogo({
  tone = 'light',
  size = 36,
  href = '/',
  priority = false,
  className,
}: {
  tone?: 'light' | 'dark';
  size?: number;
  href?: string | null;
  /** Đặt true cho logo nằm trên màn hình đầu tiên (LCP). */
  priority?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
          tone === 'dark' && 'bg-white p-0.5'
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src="/icon.png"
          alt=""
          width={size}
          height={size}
          priority={priority}
          // Ảnh có nền trắng: multiply làm nền trắng "biến mất" trên nền xám nhạt.
          className={cn('h-full w-full', tone === 'light' && 'mix-blend-multiply')}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-xl font-bold tracking-tight',
            tone === 'dark' ? 'text-white' : 'text-foreground'
          )}
        >
          LumiBach
        </span>
        <span
          className={cn(
            'mt-1 text-[10px] font-semibold tracking-[0.22em] uppercase',
            tone === 'dark' ? 'text-white/70' : 'text-muted-foreground'
          )}
        >
          Learn
        </span>
      </span>
    </>
  );

  if (!href) return <span className={cn('flex items-center gap-2.5', className)}>{content}</span>;
  return (
    <Link
      href={href}
      aria-label="LumiBach — trang chủ"
      className={cn('flex items-center gap-2.5', className)}
    >
      {content}
    </Link>
  );
}
