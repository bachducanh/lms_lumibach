export default function CoursesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="bg-muted h-6 w-32 rounded" />
          <div className="bg-muted/60 h-3.5 w-48 rounded" />
        </div>
        <div className="bg-muted h-9 w-28 rounded-lg" />
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border-border bg-card overflow-hidden rounded-xl border">
            {/* Thumbnail */}
            <div className="bg-muted h-32" />
            {/* Content */}
            <div className="space-y-3 p-4">
              <div className="bg-muted h-4 w-3/4 rounded" />
              <div className="bg-muted/60 h-3 w-full rounded" />
              <div className="bg-muted/60 h-3 w-2/3 rounded" />
              <div className="flex items-center justify-between pt-1">
                <div className="bg-muted/40 h-3 w-20 rounded" />
                <div className="bg-muted h-6 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
