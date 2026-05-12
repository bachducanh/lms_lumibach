export default function StudentsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <div className="bg-muted h-6 w-40 rounded" />
            <div className="bg-muted h-3.5 w-24 rounded" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <div className="bg-muted h-9 w-64 rounded-md" />
        <div className="bg-muted h-9 w-44 rounded-md" />
      </div>

      {/* Table */}
      <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="bg-muted/50 flex gap-6 px-4 py-3">
          {[120, 160, 80, 60, 120, 60].map((w, i) => (
            <div key={i} className="bg-muted h-3.5 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-border flex items-center gap-6 border-t px-4 py-3.5">
            <div className="flex min-w-[120px] items-center gap-3">
              <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <div className="bg-muted h-3.5 w-28 rounded" />
                <div className="bg-muted h-2.5 w-20 rounded" />
              </div>
            </div>
            <div className="bg-muted h-3 w-40 rounded" />
            <div className="bg-muted h-5 w-20 rounded-full" />
            <div className="bg-muted h-3 w-12 rounded" />
            <div className="bg-muted h-3 w-24 rounded" />
            <div className="bg-muted ml-auto h-7 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
