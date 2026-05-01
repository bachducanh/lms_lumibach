import { CodeRunPanel } from '@/components/features/code/CodeRunPanel';
import { WebEditor }    from '@/components/features/code/WebEditor';
import { Code2, Globe } from 'lucide-react';

export const metadata = { title: 'Sandbox — Tuần 14' };

export default function SandboxPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Sandbox — Tuần 14</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo CodeRunPanel (cần Judge0) và WebEditor (chạy hoàn toàn client-side).
        </p>
      </div>

      {/* Code Execution */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold">Code Execution (Python / JS / C++)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Nút <strong>Chạy</strong> gọi Judge0 qua server action. Cần{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">docker compose up -d judge0-db judge0-redis judge0-server judge0-workers</code>{' '}
          để hoạt động.
        </p>
        <CodeRunPanel />
      </section>

      {/* Web Editor */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Web Editor (HTML / CSS / JavaScript)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Live preview chạy hoàn toàn trong trình duyệt — không cần Judge0.
        </p>
        <WebEditor />
      </section>
    </div>
  );
}
