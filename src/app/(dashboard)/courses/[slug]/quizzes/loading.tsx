export default function QuizzesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-56 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted/60" />
            <div className="flex gap-3 pt-1">
              <div className="h-3 w-20 rounded bg-muted/40" />
              <div className="h-3 w-20 rounded bg-muted/40" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-lg bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}
