export default function CourseDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Course header */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="h-7 w-1/2 rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted/60" />
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-muted" />
          <div className="h-6 w-20 rounded-full bg-muted/60" />
        </div>
      </div>

      {/* Module skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="h-4 w-4 rounded bg-muted shrink-0" />
            <div className="h-4 w-48 rounded bg-muted flex-1" />
            <div className="h-4 w-16 rounded bg-muted/40" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 px-5 py-3">
                <div className="h-3.5 w-3.5 rounded bg-muted/60 shrink-0" />
                <div className="h-3.5 rounded bg-muted/60" style={{ width: `${40 + j * 15}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
