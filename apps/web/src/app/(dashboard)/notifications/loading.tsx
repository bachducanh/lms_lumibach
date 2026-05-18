export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl animate-pulse space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-muted h-5 w-5 rounded" />
          <div className="bg-muted h-6 w-28 rounded" />
        </div>
        <div className="bg-muted h-8 w-20 rounded-md" />
      </div>

      {/* Mark all button + count */}
      <div className="flex items-center justify-between">
        <div className="bg-muted h-3.5 w-24 rounded" />
        <div className="bg-muted h-7 w-28 rounded-md" />
      </div>

      {/* Notification items */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="border-border bg-card flex gap-3 rounded-xl border px-4 py-3.5">
          <div className="bg-muted h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-3.5 w-3/4 rounded" />
            <div className="bg-muted h-3 w-1/2 rounded" />
            <div className="bg-muted h-2.5 w-20 rounded" />
          </div>
          <div className="bg-muted h-7 w-20 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
