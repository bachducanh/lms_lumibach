export default function ProfileLoading() {
  return (
    <div className="max-w-2xl animate-pulse space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="bg-muted h-7 w-32 rounded" />
        <div className="bg-muted h-4 w-56 rounded" />
      </div>

      {/* Avatar + name card */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <div className="bg-muted h-20 w-20 shrink-0 rounded-full" />
          <div className="space-y-2">
            <div className="bg-muted h-5 w-40 rounded" />
            <div className="bg-muted h-4 w-56 rounded" />
            <div className="bg-muted h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-6">
        <div className="bg-muted h-5 w-36 rounded" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="bg-muted h-3.5 w-24 rounded" />
            <div className="bg-muted h-9 w-full rounded-md" />
          </div>
        ))}
        <div className="flex justify-end">
          <div className="bg-muted h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
