export default function AssignmentsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="bg-muted h-7 w-32 rounded-lg" />
        <div className="bg-muted h-9 w-28 rounded-lg" />
      </div>

      {/* Module sections */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="bg-muted h-4 w-40 rounded" />
          {[0, 1].map((j) => (
            <div
              key={j}
              className="border-border bg-card flex items-center gap-4 rounded-xl border px-5 py-4"
            >
              <div className="bg-muted h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-1/2 rounded" />
                <div className="bg-muted h-3 w-1/3 rounded" />
              </div>
              <div className="bg-muted h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
