export default function StudentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="space-y-1.5">
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-3.5 w-24 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <div className="h-9 w-64 rounded-md bg-muted" />
        <div className="h-9 w-44 rounded-md bg-muted" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="bg-muted/50 px-4 py-3 flex gap-6">
          {[120, 160, 80, 60, 120, 60].map((w, i) => (
            <div key={i} className="h-3.5 rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-t border-border px-4 py-3.5 flex gap-6 items-center">
            <div className="flex items-center gap-3 min-w-[120px]">
              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
            </div>
            <div className="h-3 w-40 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="ml-auto h-7 w-16 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
