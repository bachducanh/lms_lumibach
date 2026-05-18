export default function StudentDetailLoading() {
  return (
    <div className="max-w-2xl animate-pulse space-y-6">
      {/* Back link */}
      <div className="bg-muted h-8 w-36 rounded-md" />

      {/* Info card */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <div className="bg-muted h-16 w-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-5 w-44 rounded" />
            <div className="bg-muted h-3.5 w-24 rounded" />
            <div className="bg-muted h-3.5 w-16 rounded" />
          </div>
        </div>
        <div className="border-border grid grid-cols-2 gap-3 border-t pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-4 w-full rounded" />
          ))}
        </div>
      </div>

      {/* Enrollments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-5 w-32 rounded" />
          <div className="bg-muted h-8 w-36 rounded-md" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-border bg-card space-y-3 rounded-xl border p-4">
            <div className="bg-muted h-4 w-48 rounded" />
            <div className="bg-muted h-2 w-full rounded-full" />
            <div className="flex gap-4">
              <div className="bg-muted h-3.5 w-20 rounded" />
              <div className="bg-muted h-3.5 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
