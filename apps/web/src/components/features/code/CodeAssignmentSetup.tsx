'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, ChevronDown, Settings2 } from 'lucide-react';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { TestCaseBuilder } from './TestCaseBuilder';
import type { CodeLanguage } from '@lumibach/db';

const LANGUAGES: { key: CodeLanguage; label: string }[] = [
  { key: 'PYTHON3', label: 'Python 3' },
  { key: 'JAVASCRIPT', label: 'JavaScript' },
  { key: 'CPP17', label: 'C++ 17' },
];

type TC = {
  id?: string;
  label: string | null;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  position: number;
};

type ExistingCA = {
  id: string;
  language: CodeLanguage;
  starterCode: string | null;
  solutionCode: string | null;
  timeLimit: number;
  memoryLimit: number;
  testCases: TC[];
} | null;

type Props = {
  assignmentId: string;
  existing: ExistingCA;
};

export function CodeAssignmentSetup({ existing }: Props) {
  const [pending, start] = useTransition();
  const [language, setLanguage] = useState<CodeLanguage>(existing?.language ?? 'PYTHON3');
  const [starterCode, setStarterCode] = useState(existing?.starterCode ?? '');
  const [solutionCode, setSolutionCode] = useState(existing?.solutionCode ?? '');
  const [timeLimit, setTimeLimit] = useState(existing?.timeLimit ?? 3);
  const [memoryLimit, setMemoryLimit] = useState(
    Math.round((existing?.memoryLimit ?? 262144) / 1024)
  ); // show in MB
  const [testCases, setTestCases] = useState<TC[]>(existing?.testCases ?? []);
  const [showSolution, setShowSolution] = useState(false);

  function handleSave() {
    start(async () => {
      toast.error('Tính năng chưa triển khai.');
    });
  }

  return (
    <div className="border-border bg-card space-y-6 rounded-2xl border p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold">Cấu hình bài tập code</h3>
      </div>

      {/* ── Settings row ── */}
      <div className="flex flex-wrap gap-4">
        {/* Language */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Ngôn ngữ
          </label>
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
              className="border-input bg-background focus:ring-ring cursor-pointer appearance-none rounded-md border py-1.5 pr-8 pl-3 text-sm focus:ring-1 focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
          </div>
        </div>

        {/* Time limit */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Thời gian (giây)
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="border-input bg-background focus:ring-ring w-24 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>

        {/* Memory limit */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Bộ nhớ (MB)
          </label>
          <input
            type="number"
            min={16}
            max={512}
            step={16}
            value={memoryLimit}
            onChange={(e) => setMemoryLimit(Number(e.target.value))}
            className="border-input bg-background focus:ring-ring w-24 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Starter code ── */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Code khởi đầu (học sinh nhìn thấy)
        </label>
        <div className="border-border overflow-hidden rounded-xl border">
          <CodeEditor
            value={starterCode}
            onChange={setStarterCode}
            language={language}
            height={240}
          />
        </div>
      </div>

      {/* ── Solution code (collapsible) ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowSolution((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase transition-colors"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showSolution ? 'rotate-180' : ''}`}
          />
          Code mẫu (chỉ giáo viên thấy)
        </button>
        {showSolution && (
          <div className="border-border overflow-hidden rounded-xl border">
            <CodeEditor
              value={solutionCode}
              onChange={setSolutionCode}
              language={language}
              height={200}
            />
          </div>
        )}
      </div>

      {/* ── Test cases ── */}
      <div className="space-y-2">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Test cases
        </label>
        <TestCaseBuilder initial={testCases} onChange={setTestCases} />
      </div>

      {/* ── Save ── */}
      <div className="border-border flex justify-end border-t pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </div>
  );
}
