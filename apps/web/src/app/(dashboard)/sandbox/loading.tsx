export default function SandboxLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-muted h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <div className="bg-muted h-6 w-24 rounded" />
          <div className="bg-muted h-3.5 w-72 rounded" />
        </div>
      </div>

      {/* Language selector */}
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-10 w-28 rounded-xl" />
        ))}
      </div>

      {/* Editor area */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="bg-muted h-[540px] flex-1 rounded-xl" />
        <div className="flex w-full flex-col gap-4 lg:w-[420px]">
          <div className="bg-muted h-[130px] rounded-xl" />
          <div className="bg-muted min-h-[280px] flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
