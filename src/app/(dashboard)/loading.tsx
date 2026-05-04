export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Hero skeleton */}
      <div className="rounded-xl border border-border bg-card h-40" />

      {/* Section label skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-3 w-36 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
