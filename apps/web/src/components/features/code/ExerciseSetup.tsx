'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Loader2, ChevronDown, Settings2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebEditor, DEFAULT_WEB, type WebCode } from './WebEditor';
import { TestCaseBuilder } from './TestCaseBuilder';
import { apiClient } from '@/lib/api-client';
import { richTextIsEmpty } from '@/lib/utils';
import type { CodeLanguage, ExerciseStatus } from '@lumibach/db';

const RichTextEditor = dynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="bg-muted/30 h-40 animate-pulse rounded-xl" />,
  }
);

type TC = {
  id?: string;
  label: string | null;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  position: number;
};

type ExistingExercise = {
  id: string;
  title: string;
  description: string | null;
  language: CodeLanguage;
  status: ExerciseStatus;
  starterCode: string | null;
  solutionCode: string | null;
  starterHtml: string | null;
  starterCss: string | null;
  starterJs: string | null;
  timeLimit: number;
  memoryLimit: number;
  testCases: TC[];
};

type Props = {
  exercise: ExistingExercise;
  courseSlug: string;
};

const STATUS_LABEL: Record<ExerciseStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  CLOSED: 'Đã đóng',
};

export function ExerciseSetup({ exercise, courseSlug }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(exercise.title);
  const [description, setDescription] = useState(exercise.description ?? '');
  const [status, setStatus] = useState<ExerciseStatus>(exercise.status);
  const [starterCode, setStarterCode] = useState(exercise.starterCode ?? '');
  const [solutionCode, setSolutionCode] = useState(exercise.solutionCode ?? '');
  const [timeLimit, setTimeLimit] = useState(exercise.timeLimit);
  const [memoryLimit, setMemoryLimit] = useState(Math.round(exercise.memoryLimit / 1024));
  const [testCases, setTestCases] = useState<TC[]>(exercise.testCases);
  const [showSolution, setShowSolution] = useState(false);

  // Web starter code state
  const [webCode, setWebCode] = useState<WebCode>({
    html: exercise.starterHtml ?? DEFAULT_WEB.html,
    css: exercise.starterCss ?? DEFAULT_WEB.css,
    js: exercise.starterJs ?? DEFAULT_WEB.js,
  });

  function handleSave() {
    if (!title.trim()) {
      toast.error('Tiêu đề không được trống');
      return;
    }
    start(async () => {
      try {
        const isWeb = exercise.language === 'WEB';
        await apiClient.patch(`/code-exercises/${exercise.id}`, {
          title: title.trim(),
          description: richTextIsEmpty(description) ? undefined : description,
          status,
          ...(isWeb
            ? { starterHtml: webCode.html, starterCss: webCode.css, starterJs: webCode.js }
            : { starterCode, solutionCode, timeLimit, memoryLimit: memoryLimit * 1024 }),
        });

        if (!isWeb) {
          await apiClient.put(`/code-exercises/${exercise.id}/test-cases`, { testCases });
        }

        toast.success('Đã lưu cấu hình bài tập!');
        router.push(`/courses/${courseSlug}/exercises/${exercise.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Basic info ─────────────────────────────────────── */}
      <div className="border-border bg-card space-y-4 rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-violet-500" />
          <h3 className="font-semibold">Thông tin bài tập</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Tiêu đề
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-input bg-background focus:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Mô tả / Đề bài
          </label>
          <RichTextEditor
            content={description}
            onChange={setDescription}
            placeholder="Mô tả đề bài, yêu cầu, ví dụ..."
            compact
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Trạng thái
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExerciseStatus)}
                className="border-input bg-background focus:ring-ring cursor-pointer appearance-none rounded-md border py-1.5 pr-8 pl-3 text-sm focus:ring-1 focus:outline-none"
              >
                {(Object.keys(STATUS_LABEL) as ExerciseStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2" />
            </div>
          </div>

          {exercise.language !== 'WEB' && (
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
          )}

          {exercise.language !== 'WEB' && (
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
          )}
        </div>
      </div>

      {/* ── Non-WEB: starter / solution / test cases ──────── */}
      {exercise.language !== 'WEB' && (
        <>
          <div className="border-border bg-card space-y-4 rounded-2xl border p-6">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Code mẫu
            </h3>

            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium">
                Code khởi đầu (học sinh nhìn thấy)
              </label>
              <div className="border-border overflow-hidden rounded-xl border">
                <CodeEditor
                  value={starterCode}
                  onChange={setStarterCode}
                  language={exercise.language}
                  height={220}
                />
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowSolution((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showSolution ? 'rotate-180' : ''}`}
                />
                Code mẫu của giáo viên (ẩn với học sinh)
              </button>
              {showSolution && (
                <div className="border-border overflow-hidden rounded-xl border">
                  <CodeEditor
                    value={solutionCode}
                    onChange={setSolutionCode}
                    language={exercise.language}
                    height={200}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-border bg-card space-y-3 rounded-2xl border p-6">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Test cases
            </h3>
            <TestCaseBuilder initial={testCases} onChange={setTestCases} />
          </div>
        </>
      )}

      {/* ── WEB: starter code editor ──────────────────────── */}
      {exercise.language === 'WEB' && (
        <div className="border-border bg-card space-y-3 rounded-2xl border p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Code khởi đầu (học sinh sẽ thấy)
            </h3>
            <span className="text-muted-foreground rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400">
              Chấm thủ công
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Đặt code mẫu cho học sinh. Bài nộp sẽ được giáo viên chấm thủ công.
          </p>
          <WebEditor
            initialHtml={webCode.html}
            initialCss={webCode.css}
            initialJs={webCode.js}
            onChange={setWebCode}
            height={520}
          />
        </div>
      )}

      {/* ── Save ───────────────────────────────────────────── */}
      <div className="border-border flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/courses/${courseSlug}/exercises/${exercise.id}`)}
        >
          Xem trang bài tập
        </Button>
        <Button onClick={handleSave} disabled={pending} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </div>
    </div>
  );
}
