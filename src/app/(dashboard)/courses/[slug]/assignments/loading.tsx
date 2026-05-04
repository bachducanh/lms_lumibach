export default function AssignmentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Module sections */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-40 rounded bg-muted" />
          {[0, 1].map((j) => (
            <div key={j} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
