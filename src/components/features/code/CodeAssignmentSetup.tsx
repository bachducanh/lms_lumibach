'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, ChevronDown, Settings2 } from 'lucide-react';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { TestCaseBuilder } from './TestCaseBuilder';
import { upsertCodeAssignmentAction, saveTestCasesAction } from '@/actions/code';
import type { CodeLanguage } from '@prisma/client';

const LANGUAGES: { key: CodeLanguage; label: string }[] = [
  { key: 'PYTHON3',    label: 'Python 3'    },
  { key: 'JAVASCRIPT', label: 'JavaScript'  },
  { key: 'CPP17',      label: 'C++ 17'      },
];

type TC = { id?: string; label: string | null; input: string; expectedOutput: string; isHidden: boolean; points: number; position: number };

type ExistingCA = {
  id:          string;
  language:    CodeLanguage;
  starterCode: string | null;
  solutionCode:string | null;
  timeLimit:   number;
  memoryLimit: number;
  testCases:   TC[];
} | null;

type Props = {
  assignmentId: string;
  existing:     ExistingCA;
};

export function CodeAssignmentSetup({ assignmentId, existing }: Props) {
  const [pending, start] = useTransition();
  const [language,     setLanguage]     = useState<CodeLanguage>(existing?.language ?? 'PYTHON3');
  const [starterCode,  setStarterCode]  = useState(existing?.starterCode  ?? '');
  const [solutionCode, setSolutionCode] = useState(existing?.solutionCode ?? '');
  const [timeLimit,    setTimeLimit]    = useState(existing?.timeLimit    ?? 3);
  const [memoryLimit,  setMemoryLimit]  = useState(Math.round((existing?.memoryLimit ?? 262144) / 1024)); // show in MB
  const [testCases,    setTestCases]    = useState<TC[]>(existing?.testCases ?? []);
  const [showSolution, setShowSolution] = useState(false);

  function handleSave() {
    start(async () => {
      const r1 = await upsertCodeAssignmentAction(assignmentId, {
        language,
        starterCode,
        solutionCode,
        timeLimit,
        memoryLimit: memoryLimit * 1024, // back to KB
      });
      if (!r1.success) { toast.error(r1.error); return; }

      // Fetch the newly created codeAssignment id to save test cases
      const { getCodeAssignmentAction } = await import('@/actions/code');
      const ca = await getCodeAssignmentAction(assignmentId);
      if (!ca) { toast.error('Lỗi lấy codeAssignmentId'); return; }

      const r2 = await saveTestCasesAction(ca.id, testCases);
      if (r2.success) toast.success('Đã lưu cấu hình code và test cases');
      else toast.error(r2.error);
    });
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold">Cấu hình bài tập code</h3>
      </div>

      {/* ── Settings row ── */}
      <div className="flex flex-wrap gap-4">
        {/* Language */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ngôn ngữ</label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
              className="appearance-none rounded-md border border-input bg-background pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {LANGUAGES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Time limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thời gian (giây)</label>
          <input
            type="number" min={1} max={30}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Memory limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bộ nhớ (MB)</label>
          <input
            type="number" min={16} max={512} step={16}
            value={memoryLimit}
            onChange={(e) => setMemoryLimit(Number(e.target.value))}
            className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* ── Starter code ── */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code khởi đầu (học sinh nhìn thấy)</label>
        <div className="rounded-xl border border-border overflow-hidden">
          <CodeEditor value={starterCode} onChange={setStarterCode} language={language} height={240} />
        </div>
      </div>

      {/* ── Solution code (collapsible) ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSolution((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSolution ? 'rotate-180' : ''}`} />
          Code mẫu (chỉ giáo viên thấy)
        </button>
        {showSolution && (
          <div className="rounded-xl border border-border overflow-hidden">
            <CodeEditor value={solutionCode} onChange={setSolutionCode} language={language} height={200} />
          </div>
        )}
      </div>

      {/* ── Test cases ── */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Test cases</label>
        <TestCaseBuilder initial={testCases} onChange={setTestCases} />
      </div>

      {/* ── Save ── */}
      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </div>
  );
}
