export default function PeopleLoading() {
  return (
    <div className="max-w-2xl animate-pulse space-y-4">
      {/* Back link */}
      <div className="bg-muted h-8 w-32 rounded-md" />

      {/* Title */}
      <div className="space-y-1.5">
        <div className="bg-muted h-7 w-36 rounded" />
        <div className="bg-muted h-4 w-52 rounded" />
      </div>

      {/* Section: Teacher */}
      <div className="border-border bg-card space-y-3 rounded-xl border p-4">
        <div className="bg-muted h-4 w-24 rounded" />
        <div className="flex items-center gap-3">
          <div className="bg-muted h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <div className="bg-muted h-3.5 w-32 rounded" />
            <div className="bg-muted h-3 w-40 rounded" />
          </div>
        </div>
      </div>

      {/* Section: Students */}
      <div className="border-border bg-card space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-4 w-24 rounded" />
          <div className="bg-muted h-8 w-28 rounded-lg" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="bg-muted h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted h-3.5 w-36 rounded" />
              <div className="bg-muted h-3 w-44 rounded" />
            </div>
            <div className="bg-muted h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
