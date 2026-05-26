import { cn } from '@/lib/utils';
import type { RubricData } from '@lumibach/types';

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
        <span className="text-muted-foreground text-xs">
          {rubric.criteria.length} tiêu chí · tối đa {totalMax} điểm
        </span>
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        {/* Header row */}
        {rubric.criteria[0] && (
          <div
            className="bg-muted/50 border-border hidden border-b md:grid"
            style={{
              gridTemplateColumns: `200px repeat(${rubric.criteria[0].levels.length}, 1fr)`,
            }}
          >
            <div className="text-muted-foreground px-4 py-2 text-xs font-semibold tracking-wide uppercase">
              Tiêu chí
            </div>
            {rubric.criteria[0].levels.map((l, i) => (
              <div
                key={i}
                className="text-muted-foreground px-3 py-2 text-center text-xs font-semibold tracking-wide uppercase"
              >
                {l.label}
                <span className="block font-normal normal-case">{l.points} đ</span>
              </div>
            ))}
          </div>
        )}

        {/* Criteria rows */}
        {rubric.criteria.map((c) => (
          <div
            key={c.id}
            className={cn(
              'border-border border-b last:border-b-0 md:grid',
              'flex flex-col md:flex-none'
            )}
            style={{ gridTemplateColumns: `200px repeat(${c.levels.length}, 1fr)` }}
          >
            {/* Criterion name */}
            <div className="bg-muted/20 border-border border-b px-4 py-3 md:border-r md:border-b-0 md:bg-transparent">
              <p className="text-sm font-medium">{c.name}</p>
              {c.description && (
                <p className="text-muted-foreground mt-0.5 text-xs">{c.description}</p>
              )}
            </div>

            {/* Levels */}
            {c.levels.map((l, li) => (
              <div
                key={l.id}
                className={cn(
                  'border-border border-r px-3 py-3 text-xs last:border-r-0',
                  li === 0 && 'bg-green-500/5'
                )}
              >
                <p className="font-semibold md:hidden">
                  {l.label} — {l.points} điểm
                </p>
                {l.description && (
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{l.description}</p>
                )}
                {!l.description && <p className="text-muted-foreground/40 italic">—</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
