import { Terminal } from 'lucide-react';
import { SandboxEditor } from '@/components/features/sandbox/SandboxEditor';

export const metadata = { title: 'Sandbox — Thử nghiệm code' };

export default function SandboxPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Terminal className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sandbox</h1>
          <p className="text-muted-foreground text-sm">
            Chạy thử Python, C++ hoặc Web — không cần lưu, không chấm điểm
          </p>
        </div>
      </div>

      <SandboxEditor />
    </div>
  );
}
