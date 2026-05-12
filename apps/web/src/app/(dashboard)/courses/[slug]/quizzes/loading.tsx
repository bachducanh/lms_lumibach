export default function QuizzesLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-5 w-28 rounded" />
        <div className="bg-muted h-9 w-28 rounded-lg" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="border-border bg-card flex items-start gap-4 rounded-xl border p-5">
          <div className="bg-muted mt-0.5 h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-4 w-56 rounded" />
            <div className="bg-muted/60 h-3 w-72 rounded" />
            <div className="flex gap-3 pt-1">
              <div className="bg-muted/40 h-3 w-20 rounded" />
              <div className="bg-muted/40 h-3 w-20 rounded" />
            </div>
          </div>
          <div className="bg-muted h-8 w-20 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
