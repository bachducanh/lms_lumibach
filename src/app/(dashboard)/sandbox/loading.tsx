export default function SandboxLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted" />
        <div className="space-y-1.5">
          <div className="h-6 w-24 rounded bg-muted" />
          <div className="h-3.5 w-72 rounded bg-muted" />
        </div>
      </div>

      {/* Language selector */}
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-28 rounded-xl bg-muted" />
        ))}
      </div>

      {/* Editor area */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 h-[540px] rounded-xl bg-muted" />
        <div className="w-full lg:w-[420px] flex flex-col gap-4">
          <div className="h-[130px] rounded-xl bg-muted" />
          <div className="flex-1 min-h-[280px] rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
