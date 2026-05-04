export default function StudentDetailLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      {/* Back link */}
      <div className="h-8 w-36 rounded-md bg-muted" />

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-muted shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-44 rounded bg-muted" />
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-3.5 w-16 rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-full rounded bg-muted" />
          ))}
        </div>
      </div>

      {/* Enrollments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-8 w-36 rounded-md bg-muted" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-2 w-full rounded-full bg-muted" />
            <div className="flex gap-4">
              <div className="h-3.5 w-20 rounded bg-muted" />
              <div className="h-3.5 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
