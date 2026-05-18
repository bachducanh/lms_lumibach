export default function GradebookLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Breadcrumb */}
      <div className="bg-muted h-4 w-32 rounded" />

      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="bg-muted h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <div className="bg-muted h-6 w-28 rounded" />
          <div className="bg-muted h-3 w-40 rounded" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="bg-muted h-3.5 w-48 rounded" />
        <div className="bg-muted h-8 w-24 rounded-lg" />
      </div>

      {/* Table */}
      <div className="border-border overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/30 flex gap-6 border-b px-4 py-3">
          <div className="bg-muted h-3 w-28 rounded" />
          {[80, 72, 88, 76].map((w, i) => (
            <div key={i} className="bg-muted h-3 rounded" style={{ width: w }} />
          ))}
          <div className="bg-muted h-3 w-12 rounded" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-border/50 flex items-center gap-6 border-b px-4 py-3">
            <div className="min-w-[180px] space-y-1.5">
              <div className="bg-muted h-3.5 w-32 rounded" />
              <div className="bg-muted h-2.5 w-24 rounded" />
            </div>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="bg-muted h-4 w-16 rounded" />
            ))}
            <div className="bg-muted h-4 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
