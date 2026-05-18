export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Hero skeleton */}
      <div className="border-border bg-card h-40 rounded-xl border" />

      {/* Section label skeleton */}
      <div className="flex items-center gap-3">
        <div className="bg-muted h-3 w-24 rounded" />
        <div className="bg-border h-px flex-1" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border bg-card flex items-center gap-4 rounded-xl border p-5"
          >
            <div className="bg-muted h-11 w-11 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-3.5 w-24 rounded" />
              <div className="bg-muted/60 h-3 w-36 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
