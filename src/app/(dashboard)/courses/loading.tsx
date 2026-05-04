export default function CoursesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-3.5 w-48 rounded bg-muted/60" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Thumbnail */}
            <div className="h-32 bg-muted" />
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-2/3 rounded bg-muted/60" />
              <div className="flex items-center justify-between pt-1">
                <div className="h-3 w-20 rounded bg-muted/40" />
                <div className="h-6 w-16 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
