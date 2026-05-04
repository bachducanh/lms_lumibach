export default function GradebookLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-32 rounded bg-muted" />

      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted" />
        <div className="space-y-1.5">
          <div className="h-6 w-28 rounded bg-muted" />
          <div className="h-3 w-40 rounded bg-muted" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-48 rounded bg-muted" />
        <div className="h-8 w-24 rounded-lg bg-muted" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-6">
          <div className="h-3 w-28 rounded bg-muted" />
          {[80, 72, 88, 76].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted" style={{ width: w }} />
          ))}
          <div className="h-3 w-12 rounded bg-muted" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-b border-border/50 px-4 py-3 flex gap-6 items-center">
            <div className="space-y-1.5 min-w-[180px]">
              <div className="h-3.5 w-32 rounded bg-muted" />
              <div className="h-2.5 w-24 rounded bg-muted" />
            </div>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-4 w-16 rounded bg-muted" />
            ))}
            <div className="h-4 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
