import { cn } from '@/lib/utils';

const COLORS: Record<string, { bg: string; text: string }> = {
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
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
    <div className="border-border bg-card space-y-2 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 text-sm font-medium">{label}</p>
        {Icon && (
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', c.bg)}>
            <Icon className={cn('h-4 w-4', c.text)} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
