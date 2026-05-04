export default function ProfileLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-7 w-32 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
      </div>

      {/* Avatar + name card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-muted shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-56 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="h-5 w-36 rounded bg-muted" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-9 w-full rounded-md bg-muted" />
          </div>
        ))}
        <div className="flex justify-end">
          <div className="h-9 w-24 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
