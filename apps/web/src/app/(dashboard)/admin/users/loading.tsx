export default function AdminUsersLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="bg-muted h-7 w-48 rounded" />
          <div className="bg-muted h-4 w-32 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="bg-muted h-9 w-28 rounded-md" />
          <div className="bg-muted h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="bg-muted h-9 w-56 rounded-md" />
        <div className="bg-muted h-9 w-32 rounded-md" />
        <div className="bg-muted h-9 w-32 rounded-md" />
      </div>

      {/* Table */}
      <div className="ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <div className="bg-muted/50 flex gap-6 px-4 py-3">
          {[120, 160, 80, 90, 90, 80].map((w, i) => (
            <div key={i} className="bg-muted h-3.5 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border-border flex items-center gap-6 border-t px-4 py-3.5">
            <div className="min-w-[120px] space-y-1.5">
              <div className="bg-muted h-3.5 w-28 rounded" />
              <div className="bg-muted h-2.5 w-20 rounded" />
            </div>
            <div className="bg-muted h-3 w-40 rounded" />
            <div className="bg-muted h-5 w-20 rounded-full" />
            <div className="bg-muted h-5 w-24 rounded-full" />
            <div className="bg-muted h-3 w-20 rounded" />
            <div className="ml-auto flex gap-1">
              <div className="bg-muted h-7 w-12 rounded" />
              <div className="bg-muted h-7 w-16 rounded" />
              <div className="bg-muted h-7 w-10 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
