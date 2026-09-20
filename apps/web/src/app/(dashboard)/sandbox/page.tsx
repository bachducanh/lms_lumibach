import { Terminal } from 'lucide-react';
import { SandboxEditor } from '@/components/features/sandbox/SandboxEditor';

export const metadata = { title: 'Sandbox — Thử nghiệm code' };

export default function SandboxPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Terminal className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Sandbox</h1>
          <p className="text-muted-foreground text-sm">
            Chạy thử Python, C++ hoặc Web — không cần lưu, không chấm điểm
          </p>
        </div>
      </div>

      <SandboxEditor />
    </div>
  );
}
