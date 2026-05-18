import { cn } from '@/lib/utils';

const COLORS: Record<string, { bg: string; text: string }> = {
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
};

export function StatCard({
  label,
  value,
  hint,
  accent = 'rose',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'rose' | 'cyan' | 'violet' | 'emerald' | 'amber';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const c = COLORS[accent]!;

  return (
    <div className="border-border bg-card space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
        {Icon && (
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', c.bg)}>
            <Icon className={cn('h-3.5 w-3.5', c.text)} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  );
}
