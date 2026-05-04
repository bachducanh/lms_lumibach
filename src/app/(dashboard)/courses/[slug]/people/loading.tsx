export default function PeopleLoading() {
  return (
    <div className="space-y-4 max-w-2xl animate-pulse">
      {/* Back link */}
      <div className="h-8 w-32 rounded-md bg-muted" />

      {/* Title */}
      <div className="space-y-1.5">
        <div className="h-7 w-36 rounded bg-muted" />
        <div className="h-4 w-52 rounded bg-muted" />
      </div>

      {/* Section: Teacher */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Section: Students */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-8 w-28 rounded-lg bg-muted" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-muted" />
              <div className="h-3 w-44 rounded bg-muted" />
            </div>
            <div className="h-7 w-14 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
