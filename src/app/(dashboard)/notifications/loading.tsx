export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-muted" />
          <div className="h-6 w-28 rounded bg-muted" />
        </div>
        <div className="h-8 w-20 rounded-md bg-muted" />
      </div>

      {/* Mark all button + count */}
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 rounded bg-muted" />
        <div className="h-7 w-28 rounded-md bg-muted" />
      </div>

      {/* Notification items */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-2.5 w-20 rounded bg-muted" />
          </div>
          <div className="h-7 w-20 shrink-0 rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}
