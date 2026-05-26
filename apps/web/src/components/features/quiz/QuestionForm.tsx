'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Zap,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { QuestionTypeSelect } from '@/components/features/quiz/QuestionTypeSelect';
import type { QuestionItem } from '@lumibach/types';

type QuestionFormValues = {
  type: string;
  content: string;
  explanation: string | null | undefined;
  points: number;
  categoryId: string | null | undefined;
  options: { content: string; isCorrect: boolean }[];
  testCases: {
    input: string;
    expectedOutput: string;
    isHidden: boolean;
    points: number;
    position: number;
  }[];
  starterCode: string | null | undefined;
  solutionCode: string | null | undefined;
  timeLimit: number | null | undefined;
  memoryLimit: number | null | undefined;
};
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebCodeEditor } from '@/components/features/quiz/WebCodeEditor';
import { cn, richTextIsEmpty } from '@/lib/utils';

const RichTextEditor = dynamic(
  () =>
    import('@/components/ui/editor/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="bg-muted/30 h-40 animate-pulse rounded-xl" />,
  }
);

type QType =
  | 'MULTIPLE_CHOICE_SINGLE'
  | 'MULTIPLE_CHOICE_MULTIPLE'
  | 'TRUE_FALSE'
  | 'TRUE_FALSE_MULTI'
  | 'ESSAY'
  | 'CODE_PYTHON'
  | 'CODE_CPP'
  | 'CODE_WEB'
  | 'PARSONS'
  | 'CODE_FILL'
  | 'CODE_DEBUG_PYTHON'
  | 'CODE_DEBUG_CPP'
  | 'ORDERING'
  | 'MATCHING';

const CODE_LANG_MAP: Partial<Record<QType, 'PYTHON3' | 'CPP17' | 'WEB'>> = {
  CODE_PYTHON: 'PYTHON3',
  CODE_CPP: 'CPP17',
  CODE_WEB: 'WEB',
  CODE_DEBUG_PYTHON: 'PYTHON3',
  CODE_DEBUG_CPP: 'CPP17',
};

type Option = { content: string; isCorrect: boolean };
type TCInput = { input: string; expectedOutput: string; isHidden: boolean; points: number };

// MATCHING stores each pair in one option as JSON {left,right}; position = order.
type Pair = { left: string; right: string };
function emptyPair(): Option {
  return { content: JSON.stringify({ left: '', right: '' }), isCorrect: true };
}
function parsePair(content: string): Pair {
  try {
    const p = JSON.parse(content) as Partial<Pair>;
    return { left: p.left ?? '', right: p.right ?? '' };
  } catch {
    return { left: '', right: '' };
  }
}

function defaultOptions(type: QType): Option[] {
  if (type === 'TRUE_FALSE')
    return [
      { content: 'Đúng', isCorrect: true },
      { content: 'Sai', isCorrect: false },
    ];
  if (type === 'TRUE_FALSE_MULTI')
    return [
      { content: 'Phát biểu 1', isCorrect: true },
      { content: 'Phát biểu 2', isCorrect: false },
      { content: 'Phát biểu 3', isCorrect: true },
      { content: 'Phát biểu 4', isCorrect: false },
    ];
  // General ordering — items entered in the correct order (position = order).
  if (type === 'ORDERING')
    return [
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
      { content: '', isCorrect: false },
    ];
  // Matching — pairs of left ↔ right.
  if (type === 'MATCHING') return [emptyPair(), emptyPair(), emptyPair()];
  const noOpts: QType[] = [
    'ESSAY',
    'CODE_PYTHON',
    'CODE_CPP',
    'CODE_WEB',
    'CODE_DEBUG_PYTHON',
    'CODE_DEBUG_CPP',
    'PARSONS',
    'CODE_FILL',
  ];
  if (noOpts.includes(type)) return [];
  return [
    { content: '', isCorrect: true },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
  ];
}

type Props = {
  courseId: string;
  courseSlug: string;
  question?: QuestionItem;
  returnTo?: string;
  defaultCategoryId?: string;
};

export function QuestionForm({
  courseId,
  courseSlug,
  question,
  returnTo,
  defaultCategoryId,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const initType = (question?.type as QType) ?? 'MULTIPLE_CHOICE_SINGLE';
  const [type, setType] = useState<QType>(initType);
  const [content, setContent] = useState(question?.content ?? '');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [starterCode, setStarterCode] = useState(question?.starterCode ?? '');
  const [solutionCode, setSolutionCode] = useState(question?.solutionCode ?? '');
  const [timeLimit, setTimeLimit] = useState(String(question?.timeLimit ?? 3));
  const [memoryLimit, setMemoryLimit] = useState(String(question?.memoryLimit ?? 256));
  const [showSolution, setShowSolution] = useState(
    ['CODE_PYTHON', 'CODE_CPP', 'CODE_DEBUG_PYTHON', 'CODE_DEBUG_CPP'].includes(initType)
  );
  const [tcGenerating, setTcGenerating] = useState<Record<number, boolean>>({});
  const [parsonsCode, setParsonsCode] = useState('');
  const [parsonsLang, setParsonsLang] = useState<'PYTHON3' | 'JAVASCRIPT' | 'CPP17'>('PYTHON3');
  const [fillLang, setFillLang] = useState<'PYTHON3' | 'JAVASCRIPT' | 'CPP17'>('PYTHON3');

  const [options, setOptions] = useState<Option[]>(() => {
    if (question)
      return question.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect }));
    return defaultOptions(initType);
  });

  const [testCases, setTestCases] = useState<TCInput[]>(() => {
    if (question?.testCases?.length) {
      return question.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        points: tc.points,
      }));
    }
    return [];
  });

  function handleTypeChange(t: QType) {
    setType(t);
    setOptions(defaultOptions(t));
    const hasTC: QType[] = [
      'CODE_PYTHON',
      'CODE_CPP',
      'CODE_WEB',
      'CODE_DEBUG_PYTHON',
      'CODE_DEBUG_CPP',
    ];
    if (!hasTC.includes(t)) setTestCases([]);
    setShowSolution(['CODE_PYTHON', 'CODE_CPP', 'CODE_DEBUG_PYTHON', 'CODE_DEBUG_CPP'].includes(t));
  }

  // ── Option helpers ─────────────────────────────────────────

  function toggleCorrect(i: number) {
    if (type === 'MULTIPLE_CHOICE_SINGLE') {
      setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: j === i })));
    } else if (type === 'TRUE_FALSE_MULTI') {
      setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)));
    } else {
      setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)));
    }
  }

  function updateOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, content: val } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { content: '', isCorrect: false }]);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, j) => j !== i));
  }

  function moveOption(i: number, dir: -1 | 1) {
    const j = i + dir;
    setOptions((prev) => {
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  // ── Matching pair helpers (each option.content = JSON {left,right}) ──

  function updatePair(i: number, side: 'left' | 'right', val: string) {
    setOptions((prev) =>
      prev.map((o, j) => {
        if (j !== i) return o;
        const p = parsePair(o.content);
        return { ...o, content: JSON.stringify({ ...p, [side]: val }) };
      })
    );
  }

  function addPair() {
    setOptions((prev) => [...prev, emptyPair()]);
  }

  // ── Parsons: parse code into lines ────────────────────────

  function handleParseLines() {
    const lines = parsonsCode.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error('Cần ít nhất 2 dòng code.');
      return;
    }
    setOptions(lines.map((l) => ({ content: l, isCorrect: false })));
    toast.success(`Đã phân tách thành ${lines.length} dòng.`);
  }

  // ── CODE_FILL: sync blank count with options ───────────────

  function handleFillTemplateChange(val: string) {
    setStarterCode(val);
    const blanks = (val.match(/___/g) ?? []).length;
    setOptions((prev) => {
      if (prev.length === blanks) return prev;
      if (prev.length < blanks)
        return [
          ...prev,
          ...Array.from({ length: blanks - prev.length }, () => ({ content: '', isCorrect: true })),
        ];
      return prev.slice(0, blanks);
    });
  }

  // ── Test case helpers ──────────────────────────────────────

  function addTestCase() {
    setTestCases((prev) => [...prev, { input: '', expectedOutput: '', isHidden: true, points: 1 }]);
  }

  function updateTC(i: number, field: keyof TCInput, val: string | boolean | number) {
    setTestCases((prev) => prev.map((tc, j) => (j === i ? { ...tc, [field]: val } : tc)));
  }

  function removeTC(i: number) {
    setTestCases((prev) => prev.filter((_, j) => j !== i));
  }

  // ── Generate expected output from solution code ────────────

  async function generateExpectedOutput(tcIndex: number) {
    if (!solutionCode.trim()) {
      toast.error('Cần nhập code đáp án trước.');
      return;
    }
    const tc = testCases[tcIndex];
    if (!tc) return;
    const lang: 'PYTHON3' | 'CPP17' =
      type === 'CODE_PYTHON' || type === 'CODE_DEBUG_PYTHON' ? 'PYTHON3' : 'CPP17';
    setTcGenerating((prev) => ({ ...prev, [tcIndex]: true }));
    try {
      const data = await apiClient.post<{ output: string }>(
        `/questions/${question?.id ?? 'tmp'}/run-solution`,
        {
          code: solutionCode,
          language: lang,
          input: tc.input,
          timeLimitSec: Number(timeLimit) || 3,
          memoryLimitKB: (Number(memoryLimit) || 256) * 1024,
        }
      );
      updateTC(tcIndex, 'expectedOutput', data.output);
      toast.success('Đã sinh expected output.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setTcGenerating((prev) => ({ ...prev, [tcIndex]: false }));
    }
  }

  // ── Validate ───────────────────────────────────────────────

  function validate(): string | null {
    if (richTextIsEmpty(content)) return 'Nội dung câu hỏi không được để trống.';
    if (type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE') {
      if (options.some((o) => !o.content.trim())) return 'Tất cả đáp án phải có nội dung.';
      if (!options.some((o) => o.isCorrect)) return 'Phải có ít nhất 1 đáp án đúng.';
      if (type === 'MULTIPLE_CHOICE_SINGLE' && options.filter((o) => o.isCorrect).length > 1) {
        return 'Trắc nghiệm 1 đáp án chỉ được có 1 đáp án đúng.';
      }
    }
    if (type === 'TRUE_FALSE_MULTI') {
      if (options.some((o) => !o.content.trim())) return 'Tất cả phát biểu phải có nội dung.';
      if (options.length < 2) return 'Phải có ít nhất 2 phát biểu.';
    }
    if (type === 'CODE_PYTHON' || type === 'CODE_CPP') {
      if (testCases.length === 0) return 'Phải có ít nhất 1 test case để tự chấm.';
    }
    if (type === 'PARSONS') {
      if (options.length < 2) return 'Phải có ít nhất 2 dòng code.';
      if (options.some((o) => !o.content.trim())) return 'Tất cả dòng code phải có nội dung.';
    }
    if (type === 'ORDERING') {
      if (options.length < 2) return 'Phải có ít nhất 2 mục để sắp xếp.';
      if (options.some((o) => !o.content.trim())) return 'Tất cả các mục phải có nội dung.';
    }
    if (type === 'MATCHING') {
      if (options.length < 2) return 'Phải có ít nhất 2 cặp ghép nối.';
      if (
        options.some((o) => !parsePair(o.content).left.trim() || !parsePair(o.content).right.trim())
      )
        return 'Mỗi cặp phải nhập đủ cả hai vế.';
    }
    if (type === 'CODE_FILL') {
      if (!starterCode.includes('___')) return 'Template phải có ít nhất 1 chỗ trống (___)';
      if (options.length === 0) return 'Phải nhập đáp án cho tất cả các ô trống.';
      if (options.some((o) => !o.content.trim())) return 'Đáp án không được để trống.';
    }
    if (type === 'CODE_DEBUG_PYTHON' || type === 'CODE_DEBUG_CPP') {
      if (testCases.length === 0) return 'Phải có ít nhất 1 test case để tự chấm.';
    }
    return null;
  }

  // ── Save ───────────────────────────────────────────────────

  async function handleSave() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (pending) return;

    const isCode = type === 'CODE_PYTHON' || type === 'CODE_CPP' || type === 'CODE_WEB';
    const isDebug = type === 'CODE_DEBUG_PYTHON' || type === 'CODE_DEBUG_CPP';
    const baseVals = {
      type,
      content: content.trim(),
      explanation: explanation.trim() || null,
      points: Number(points) || 1,
      categoryId: question?.categoryId ?? defaultCategoryId ?? null,
    };

    let values: QuestionFormValues;
    if (type === 'PARSONS') {
      values = {
        ...baseVals,
        options,
        testCases: [],
        starterCode: null,
        solutionCode: null,
        timeLimit: null,
        memoryLimit: null,
      };
    } else if (type === 'CODE_FILL') {
      values = {
        ...baseVals,
        options,
        testCases: [],
        starterCode: starterCode || null,
        solutionCode: null,
        timeLimit: null,
        memoryLimit: null,
      };
    } else if (isDebug) {
      values = {
        ...baseVals,
        options: [],
        testCases: testCases.map((tc, i) => ({ ...tc, position: i })),
        starterCode: starterCode || null,
        solutionCode: solutionCode || null,
        timeLimit: Number(timeLimit) || 3,
        memoryLimit: (Number(memoryLimit) || 256) * 1024,
      };
    } else {
      values = {
        ...baseVals,
        options: isCode ? [] : options,
        testCases: isCode ? testCases.map((tc, i) => ({ ...tc, position: i })) : [],
        starterCode: isCode ? starterCode || null : null,
        solutionCode: isCode ? solutionCode || null : null,
        timeLimit: isCode && type !== 'CODE_WEB' ? Number(timeLimit) || 3 : null,
        memoryLimit: isCode && type !== 'CODE_WEB' ? Number(memoryLimit) * 1024 || 262144 : null,
      };
    }

    setPending(true);
    try {
      if (question) {
        await apiClient.patch(`/questions/${question.id}`, values);
      } else {
        await apiClient.post('/questions', { courseId, ...values });
      }
      toast.success(question ? 'Đã lưu thay đổi.' : 'Đã tạo câu hỏi.');
      router.push(returnTo ?? `/courses/${courseSlug}/questions`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setPending(false);
    }
  }

  const isMCQ = type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE';
  const isTF = type === 'TRUE_FALSE';
  const isTFMulti = type === 'TRUE_FALSE_MULTI';
  const isEssay = type === 'ESSAY';
  const isParsons = type === 'PARSONS';
  const isCodeFill = type === 'CODE_FILL';
  const isOrdering = type === 'ORDERING';
  const isMatching = type === 'MATCHING';
  const isDebugType = type === 'CODE_DEBUG_PYTHON' || type === 'CODE_DEBUG_CPP';
  const isCodeType = type === 'CODE_PYTHON' || type === 'CODE_CPP' || type === 'CODE_WEB';
  const isAutoGraded = isCodeType || isDebugType;
  const codeEditorLang = CODE_LANG_MAP[type];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Type selector */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Loại câu hỏi
        </label>
        <QuestionTypeSelect
          value={type}
          onChange={(t) => handleTypeChange(t as QType)}
          disabled={!!question}
        />
        {question && (
          <p className="text-muted-foreground text-xs">
            Không thể thay đổi loại câu hỏi sau khi tạo.
          </p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {isTFMulti ? 'Nội dung / Ngữ cảnh câu hỏi' : 'Nội dung câu hỏi'}
        </label>
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder={
            isTFMulti ? 'Nhập ngữ cảnh / đề bài (các phát biểu bên dưới)...' : 'Nhập câu hỏi...'
          }
          compact
        />
      </div>

      {/* MCQ options */}
      {isMCQ && (
        <div className="space-y-2">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Đáp án {type === 'MULTIPLE_CHOICE_SINGLE' ? '(chọn 1 đúng)' : '(chọn nhiều đúng)'}
          </label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => toggleCorrect(i)}
                  className={cn(
                    'shrink-0 transition-colors',
                    o.isCorrect
                      ? 'text-green-500'
                      : 'text-muted-foreground/40 hover:text-muted-foreground'
                  )}
                  title={o.isCorrect ? 'Đáp án đúng' : 'Đánh dấu đúng'}
                >
                  {o.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <input
                  value={o.content}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Đáp án ${String.fromCharCode(65 + i)}...`}
                  className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              onClick={addOption}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm đáp án
            </button>
          )}
        </div>
      )}

      {/* TRUE_FALSE */}
      {isTF && (
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Đáp án đúng
          </label>
          <div className="flex gap-3">
            {options.map((o, i) => (
              <button
                key={i}
                onClick={() =>
                  setOptions(options.map((opt, j) => ({ ...opt, isCorrect: j === i })))
                }
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  o.isCorrect
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {o.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {o.content}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TRUE_FALSE_MULTI — list of statements */}
      {isTFMulti && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Các phát biểu (đánh dấu phát biểu nào là Đúng)
            </label>
            <span className="text-muted-foreground text-xs">{options.length} phát biểu</span>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div
                key={i}
                className="border-border bg-background flex items-start gap-3 rounded-lg border px-3 py-2.5"
              >
                <span className="bg-muted text-muted-foreground mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {String.fromCharCode(97 + i)}
                </span>
                <input
                  value={o.content}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Phát biểu ${String.fromCharCode(97 + i)}...`}
                  className="placeholder:text-muted-foreground/50 flex-1 bg-transparent text-sm focus:outline-none"
                />
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() =>
                      setOptions(
                        options.map((opt, j) => (j === i ? { ...opt, isCorrect: true } : opt))
                      )
                    }
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-medium transition-colors',
                      o.isCorrect
                        ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600'
                    )}
                  >
                    Đúng
                  </button>
                  <button
                    onClick={() =>
                      setOptions(
                        options.map((opt, j) => (j === i ? { ...opt, isCorrect: false } : opt))
                      )
                    }
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-medium transition-colors',
                      !o.isCorrect
                        ? 'border-red-400 bg-red-400/15 text-red-700 dark:text-red-400'
                        : 'border-border text-muted-foreground hover:border-red-400 hover:text-red-600'
                    )}
                  >
                    Sai
                  </button>
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground/40 hover:text-destructive ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button
              onClick={() => setOptions((prev) => [...prev, { content: '', isCorrect: true }])}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm phát biểu
            </button>
          )}
        </div>
      )}

      {/* ESSAY hint */}
      {isEssay && (
        <div className="border-border bg-muted/20 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
          Câu hỏi tự luận — học sinh nhập câu trả lời dạng văn bản, giáo viên chấm thủ công.
        </div>
      )}

      {/* PARSONS */}
      {isParsons && (
        <div className="space-y-5">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
            <strong>Sắp xếp code (Parsons)</strong> — Học sinh kéo thả các dòng code để sắp xếp đúng
            thứ tự.
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Nhập toàn bộ code đúng
              </label>
              <select
                value={parsonsLang}
                onChange={(e) => setParsonsLang(e.target.value as typeof parsonsLang)}
                className="border-input bg-background rounded border px-2 py-0.5 text-xs focus:outline-none"
              >
                <option value="PYTHON3">Python</option>
                <option value="JAVASCRIPT">JavaScript</option>
                <option value="CPP17">C++</option>
              </select>
            </div>
            <div className="border-border overflow-hidden rounded-xl border">
              <CodeEditor
                value={parsonsCode}
                onChange={setParsonsCode}
                language={parsonsLang}
                height={220}
              />
            </div>
            <button
              type="button"
              onClick={handleParseLines}
              className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Zap className="h-3.5 w-3.5" /> Phân tách thành dòng
            </button>
          </div>
          {options.length > 0 && (
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Thứ tự đúng ({options.length} dòng)
              </label>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                      {i + 1}
                    </span>
                    <input
                      value={o.content}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 font-mono text-sm focus:ring-1 focus:outline-none"
                    />
                    <button
                      onClick={() => moveOption(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground/40 hover:text-foreground p-1 transition-colors disabled:opacity-20"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveOption(i, 1)}
                      disabled={i === options.length - 1}
                      className="text-muted-foreground/40 hover:text-foreground p-1 transition-colors disabled:opacity-20"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm dòng
              </button>
            </div>
          )}
        </div>
      )}

      {/* CODE_FILL */}
      {isCodeFill && (
        <div className="space-y-5">
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-xs text-violet-700 dark:text-violet-400">
            <strong>Điền vào chỗ trống</strong> — Dùng{' '}
            <code className="rounded bg-violet-500/10 px-1 font-mono">___</code> để đánh dấu chỗ cần
            điền.
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Template code (dùng ___ cho chỗ trống)
              </label>
              <select
                value={fillLang}
                onChange={(e) => setFillLang(e.target.value as typeof fillLang)}
                className="border-input bg-background rounded border px-2 py-0.5 text-xs focus:outline-none"
              >
                <option value="PYTHON3">Python</option>
                <option value="JAVASCRIPT">JavaScript</option>
                <option value="CPP17">C++</option>
              </select>
            </div>
            <div className="border-border overflow-hidden rounded-xl border">
              <CodeEditor
                value={starterCode}
                onChange={handleFillTemplateChange}
                language={fillLang}
                height={220}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Phát hiện <strong>{(starterCode.match(/___/g) ?? []).length}</strong> chỗ trống.
            </p>
          </div>
          {options.length > 0 && (
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Đáp án từng ô
              </label>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="shrink-0 rounded border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-400">
                      [{i + 1}]
                    </span>
                    <input
                      value={o.content}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Đáp án ô ${i + 1}...`}
                      className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 font-mono text-sm focus:ring-1 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                So sánh chính xác sau khi trim khoảng trắng.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ORDERING — general drag-to-order */}
      {isOrdering && (
        <div className="space-y-3">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-xs text-sky-700 dark:text-sky-400">
            <strong>Sắp xếp thứ tự</strong> — Nhập các mục theo <strong>đúng thứ tự</strong>. Khi
            làm bài, các mục sẽ bị xáo trộn và học sinh kéo thả để sắp xếp lại.
          </div>
          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Các mục (nhập theo đúng thứ tự) · {options.length} mục
            </label>
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                    {i + 1}
                  </span>
                  <input
                    value={o.content}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Mục thứ ${i + 1}...`}
                    className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                  />
                  <button
                    onClick={() => moveOption(i, -1)}
                    disabled={i === 0}
                    className="text-muted-foreground/40 hover:text-foreground p-1 transition-colors disabled:opacity-20"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveOption(i, 1)}
                    disabled={i === options.length - 1}
                    className="text-muted-foreground/40 hover:text-foreground p-1 transition-colors disabled:opacity-20"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addOption}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mục
            </button>
          </div>
        </div>
      )}

      {/* MATCHING — drag-to-pair */}
      {isMatching && (
        <div className="space-y-3">
          <div className="rounded-lg border border-lime-500/30 bg-lime-500/5 px-4 py-3 text-xs text-lime-700 dark:text-lime-400">
            <strong>Ghép nối</strong> — Mỗi dòng là một cặp đúng (vế trái ↔ vế phải). Khi làm bài,
            các vế phải sẽ bị xáo trộn và học sinh kéo thả để ghép cho đúng.
          </div>
          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Các cặp ghép nối · {options.length} cặp
            </label>
            <div className="space-y-2">
              {options.map((o, i) => {
                const p = parsePair(o.content);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {i + 1}
                    </span>
                    <input
                      value={p.left}
                      onChange={(e) => updatePair(i, 'left', e.target.value)}
                      placeholder={`Vế trái ${i + 1}...`}
                      className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                    />
                    <ArrowRight className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                    <input
                      value={p.right}
                      onChange={(e) => updatePair(i, 'right', e.target.value)}
                      placeholder={`Vế phải ${i + 1}...`}
                      className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={addPair}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm cặp
            </button>
          </div>
        </div>
      )}

      {/* CODE_DEBUG */}
      {isDebugType && (
        <div className="space-y-5">
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-xs text-orange-700 dark:text-orange-400">
            <strong>Debug code</strong> — Cung cấp code có lỗi, học sinh sửa cho đúng. Chấm tự động
            qua test cases.
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Code có lỗi (hiện cho học sinh)
            </label>
            <div className="overflow-hidden rounded-xl border border-orange-500/40">
              <CodeEditor
                value={starterCode}
                onChange={setStarterCode}
                language={codeEditorLang === 'PYTHON3' ? 'PYTHON3' : 'CPP17'}
                height={200}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Code đúng (để sinh expected output)
              </label>
              <button
                type="button"
                onClick={() => setShowSolution((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs"
              >
                {showSolution ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showSolution ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showSolution && (
              <div className="border-primary/40 ring-primary/20 overflow-hidden rounded-xl border ring-1">
                <CodeEditor
                  value={solutionCode}
                  onChange={setSolutionCode}
                  language={codeEditorLang === 'PYTHON3' ? 'PYTHON3' : 'CPP17'}
                  height={220}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Giới hạn thời gian (giây)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Giới hạn bộ nhớ (MB)
              </label>
              <input
                type="number"
                min={32}
                max={512}
                step={32}
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
                className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Test cases
              </label>
              <span className="text-muted-foreground text-xs">{testCases.length} test case</span>
            </div>
            {testCases.map((tc, i) => (
              <div key={i} className="border-border bg-muted/10 space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold">Test #{i + 1}</span>
                  <div className="flex-1" />
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={tc.isHidden}
                      onChange={(e) => updateTC(i, 'isHidden', e.target.checked)}
                      className="rounded"
                    />
                    Ẩn khỏi học sinh
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={tc.points}
                    onChange={(e) => updateTC(i, 'points', parseFloat(e.target.value) || 0)}
                    className="border-input bg-background w-16 rounded border px-2 py-0.5 text-center text-xs focus:outline-none"
                  />
                  <span className="text-muted-foreground text-xs">điểm</span>
                  <button
                    onClick={() => removeTC(i)}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-[10px] font-medium uppercase">
                      Input (stdin)
                    </label>
                    <textarea
                      value={tc.input}
                      onChange={(e) => updateTC(i, 'input', e.target.value)}
                      placeholder="Dữ liệu đầu vào..."
                      rows={3}
                      className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground text-[10px] font-medium uppercase">
                        Expected output
                      </label>
                      <button
                        type="button"
                        onClick={() => void generateExpectedOutput(i)}
                        disabled={tcGenerating[i]}
                        className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50"
                      >
                        {tcGenerating[i] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        {tcGenerating[i] ? 'Đang chạy...' : '⚡ Sinh'}
                      </button>
                    </div>
                    <textarea
                      value={tc.expectedOutput}
                      onChange={(e) => updateTC(i, 'expectedOutput', e.target.value)}
                      placeholder="Kết quả mong đợi..."
                      rows={3}
                      className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addTestCase}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm test case
            </button>
          </div>
        </div>
      )}

      {/* CODE_* types */}
      {isCodeType && (
        <div className="space-y-5">
          {/* Starter code */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Code khởi đầu (hiện cho học sinh)
            </label>
            {codeEditorLang === 'WEB' ? (
              <WebCodeEditor value={starterCode} onChange={setStarterCode} height={320} />
            ) : (
              <div className="border-border overflow-hidden rounded-xl border">
                <CodeEditor
                  value={starterCode}
                  onChange={setStarterCode}
                  language={codeEditorLang ?? 'PYTHON3'}
                  height={200}
                />
              </div>
            )}
          </div>

          {/* Solution / Answer code */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {type === 'CODE_PYTHON' || type === 'CODE_CPP'
                    ? 'Đáp án (code mẫu — dùng để sinh expected output)'
                    : 'Code mẫu (chỉ giáo viên xem)'}
                </label>
                {(type === 'CODE_PYTHON' || type === 'CODE_CPP') && (
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Viết code đúng ở đây, rồi ấn ⚡ Sinh ở từng test case để tự sinh expected
                    output.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowSolution((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs"
              >
                {showSolution ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showSolution ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showSolution &&
              (codeEditorLang === 'WEB' ? (
                <WebCodeEditor value={solutionCode} onChange={setSolutionCode} height={320} />
              ) : (
                <div
                  className={cn(
                    'overflow-hidden rounded-xl border',
                    type === 'CODE_PYTHON' || type === 'CODE_CPP'
                      ? 'border-primary/40 ring-primary/20 ring-1'
                      : 'border-border'
                  )}
                >
                  <CodeEditor
                    value={solutionCode}
                    onChange={setSolutionCode}
                    language={codeEditorLang ?? 'PYTHON3'}
                    height={220}
                  />
                </div>
              ))}
          </div>

          {/* Time / Memory limits (non-WEB only) */}
          {type !== 'CODE_WEB' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Giới hạn thời gian (giây)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Giới hạn bộ nhớ (MB)
                </label>
                <input
                  type="number"
                  min={32}
                  max={512}
                  step={32}
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(e.target.value)}
                  className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Test cases (non-WEB only for auto-grading) */}
          {type !== 'CODE_WEB' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Test cases (tự chấm điểm)
                </label>
                <span className="text-muted-foreground text-xs">{testCases.length} test case</span>
              </div>
              {testCases.map((tc, i) => (
                <div key={i} className="border-border bg-muted/10 space-y-2 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-semibold">
                      Test #{i + 1}
                    </span>
                    <div className="flex-1" />
                    <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={tc.isHidden}
                        onChange={(e) => updateTC(i, 'isHidden', e.target.checked)}
                        className="rounded"
                      />
                      Ẩn khỏi học sinh
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={tc.points}
                      onChange={(e) => updateTC(i, 'points', parseFloat(e.target.value) || 0)}
                      className="border-input bg-background w-16 rounded border px-2 py-0.5 text-center text-xs focus:outline-none"
                      title="Điểm"
                    />
                    <span className="text-muted-foreground text-xs">điểm</span>
                    <button
                      onClick={() => removeTC(i)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-medium uppercase">
                        Input (stdin)
                      </label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => updateTC(i, 'input', e.target.value)}
                        placeholder="Dữ liệu đầu vào..."
                        rows={3}
                        className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-muted-foreground text-[10px] font-medium uppercase">
                          Expected output
                        </label>
                        <button
                          type="button"
                          onClick={() => void generateExpectedOutput(i)}
                          disabled={tcGenerating[i]}
                          className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50"
                          title="Chạy code đáp án với input này để sinh expected output"
                        >
                          {tcGenerating[i] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          {tcGenerating[i] ? 'Đang chạy...' : '⚡ Sinh'}
                        </button>
                      </div>
                      <textarea
                        value={tc.expectedOutput}
                        onChange={(e) => updateTC(i, 'expectedOutput', e.target.value)}
                        placeholder="Kết quả mong đợi (hoặc ấn ⚡ Sinh)..."
                        rows={3}
                        className="border-input bg-background focus:ring-ring w-full resize-y rounded-md border px-2.5 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addTestCase}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm test case
              </button>
            </div>
          )}

          {type === 'CODE_WEB' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              Code Web — học sinh viết HTML/CSS/JS, giáo viên xem preview và chấm thủ công.
            </div>
          )}
        </div>
      )}

      {/* Points + explanation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {isAutoGraded && type !== 'CODE_WEB'
              ? 'Điểm (phân bổ qua test cases)'
              : 'Điểm mặc định'}
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Giải thích (hiện sau khi nộp bài — tuỳ chọn)
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Giải thích đáp án đúng..."
          rows={2}
          className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Huỷ
        </Button>
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : question ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
        </Button>
      </div>
    </div>
  );
}
