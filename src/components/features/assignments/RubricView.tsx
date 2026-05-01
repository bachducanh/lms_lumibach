import { cn } from '@/lib/utils';
import type { RubricData } from '@/actions/rubric';

type Props = {
  rubric: RubricData;
};

export function RubricView({ rubric }: Props) {
  const totalMax = rubric.criteria.reduce((sum, c) => {
    return sum + Math.max(0, ...c.levels.map((l) => l.points));
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Rubric chấm bài</h3>
        <span className="text-xs text-muted-foreground">{rubric.criteria.length} tiêu chí · tối đa {totalMax} điểm</span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        {rubric.criteria[0] && (
          <div
            className="hidden md:grid bg-muted/50 border-b border-border"
            style={{ gridTemplateColumns: `200px repeat(${rubric.criteria[0].levels.length}, 1fr)` }}
          >
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiêu chí</div>
            {rubric.criteria[0].levels.map((l, i) => (
              <div key={i} className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                {l.label}
                <span className="block font-normal normal-case">{l.points} đ</span>
              </div>
            ))}
          </div>
        )}

        {/* Criteria rows */}
        {rubric.criteria.map((c, ci) => (
          <div
            key={c.id}
            className={cn(
              'md:grid border-b border-border last:border-b-0',
              'flex flex-col md:flex-none',
            )}
            style={{ gridTemplateColumns: `200px repeat(${c.levels.length}, 1fr)` }}
          >
            {/* Criterion name */}
            <div className="px-4 py-3 bg-muted/20 md:bg-transparent border-b md:border-b-0 md:border-r border-border">
              <p className="text-sm font-medium">{c.name}</p>
              {c.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
              )}
            </div>

            {/* Levels */}
            {c.levels.map((l, li) => (
              <div
                key={l.id}
                className={cn(
                  'px-3 py-3 text-xs border-r border-border last:border-r-0',
                  li === 0 && 'bg-green-500/5',
                )}
              >
                <p className="font-semibold md:hidden">{l.label} — {l.points} điểm</p>
                {l.description && (
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{l.description}</p>
                )}
                {!l.description && (
                  <p className="text-muted-foreground/40 italic">—</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
