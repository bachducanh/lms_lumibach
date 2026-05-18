export default function CourseDetailLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Course header */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-6">
        <div className="bg-muted h-7 w-1/2 rounded" />
        <div className="bg-muted/60 h-4 w-3/4 rounded" />
        <div className="flex gap-2">
          <div className="bg-muted h-6 w-20 rounded-full" />
          <div className="bg-muted/60 h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* Module skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="border-border bg-card overflow-hidden rounded-xl border">
          <div className="border-border flex items-center gap-3 border-b px-5 py-4">
            <div className="bg-muted h-4 w-4 shrink-0 rounded" />
            <div className="bg-muted h-4 w-48 flex-1 rounded" />
            <div className="bg-muted/40 h-4 w-16 rounded" />
          </div>
          <div className="divide-border divide-y">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 px-5 py-3">
                <div className="bg-muted/60 h-3.5 w-3.5 shrink-0 rounded" />
                <div className="bg-muted/60 h-3.5 rounded" style={{ width: `${40 + j * 15}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
