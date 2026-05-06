'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Trash2, CheckCircle2, Circle, Eye, EyeOff, Zap, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  createQuestionAction, updateQuestionAction, runSolutionCodeForTCAction,
  type QuestionItem, type QuestionFormValues, type QuestionTestCase,
} from '@/actions/questions';
import { CodeEditor } from '@/components/ui/editor/CodeEditor';
import { WebCodeEditor } from '@/components/features/quiz/WebCodeEditor';
import { cn } from '@/lib/utils';

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
  | 'CODE_DEBUG_CPP';

const TYPE_LABEL: Record<QType, string> = {
  MULTIPLE_CHOICE_SINGLE:   'Trắc nghiệm (1 đáp án)',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
  TRUE_FALSE:               'Đúng / Sai',
  TRUE_FALSE_MULTI:         'Đúng / Sai (nhiều phát biểu)',
  ESSAY:                    'Tự luận',
  CODE_PYTHON:              'Code Python (tự chấm)',
  CODE_CPP:                 'Code C++ (tự chấm)',
  CODE_WEB:                 'Code Web (chấm tay)',
  PARSONS:                  'Sắp xếp code (Parsons)',
  CODE_FILL:                'Điền vào chỗ trống',
  CODE_DEBUG_PYTHON:        'Debug Python',
  CODE_DEBUG_CPP:           'Debug C++',
};

const CODE_LANG_MAP: Partial<Record<QType, 'PYTHON3' | 'CPP17' | 'WEB'>> = {
  CODE_PYTHON:       'PYTHON3',
  CODE_CPP:          'CPP17',
  CODE_WEB:          'WEB',
  CODE_DEBUG_PYTHON: 'PYTHON3',
  CODE_DEBUG_CPP:    'CPP17',
};

type Option   = { content: string; isCorrect: boolean };
type TCInput  = { input: string; expectedOutput: string; isHidden: boolean; points: number };

function defaultOptions(type: QType): Option[] {
  if (type === 'TRUE_FALSE') return [
    { content: 'Đúng', isCorrect: true  },
    { content: 'Sai',  isCorrect: false },
  ];
  if (type === 'TRUE_FALSE_MULTI') return [
    { content: 'Phát biểu 1', isCorrect: true  },
    { content: 'Phát biểu 2', isCorrect: false },
    { content: 'Phát biểu 3', isCorrect: true  },
    { content: 'Phát biểu 4', isCorrect: false },
  ];
  const noOpts: QType[] = ['ESSAY','CODE_PYTHON','CODE_CPP','CODE_WEB','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP','PARSONS','CODE_FILL'];
  if (noOpts.includes(type)) return [];
  return [
    { content: '', isCorrect: true  },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
  ];
}

type Props = {
  courseId:           string;
  courseSlug:         string;
  question?:          QuestionItem;
  returnTo?:          string;
  defaultCategoryId?: string;
};

export function QuestionForm({ courseId, courseSlug, question, returnTo, defaultCategoryId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const initType = (question?.type as QType) ?? 'MULTIPLE_CHOICE_SINGLE';
  const [type,         setType]         = useState<QType>(initType);
  const [content,      setContent]      = useState(question?.content ?? '');
  const [explanation,  setExplanation]  = useState(question?.explanation ?? '');
  const [points,       setPoints]       = useState(String(question?.points ?? 1));
  const [starterCode,  setStarterCode]  = useState(question?.starterCode ?? '');
  const [solutionCode, setSolutionCode] = useState(question?.solutionCode ?? '');
  const [timeLimit,    setTimeLimit]    = useState(String(question?.timeLimit ?? 3));
  const [memoryLimit,  setMemoryLimit]  = useState(String(question?.memoryLimit ?? 256));
  const [showSolution, setShowSolution] = useState(
    ['CODE_PYTHON','CODE_CPP','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP'].includes(initType),
  );
  const [tcGenerating, setTcGenerating] = useState<Record<number, boolean>>({});
  const [, startGenTransition] = useTransition();
  const [parsonsCode, setParsonsCode] = useState('');
  const [parsonsLang, setParsonsLang] = useState<'PYTHON3' | 'JAVASCRIPT' | 'CPP17'>('PYTHON3');
  const [fillLang,    setFillLang]    = useState<'PYTHON3' | 'JAVASCRIPT' | 'CPP17'>('PYTHON3');

  const [options, setOptions] = useState<Option[]>(() => {
    if (question) return question.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect }));
    return defaultOptions(initType);
  });

  const [testCases, setTestCases] = useState<TCInput[]>(() => {
    if (question?.testCases?.length) {
      return question.testCases.map((tc) => ({
        input: tc.input, expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden, points: tc.points,
      }));
    }
    return [];
  });

  function handleTypeChange(t: QType) {
    setType(t);
    setOptions(defaultOptions(t));
    const hasTC: QType[] = ['CODE_PYTHON','CODE_CPP','CODE_WEB','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP'];
    if (!hasTC.includes(t)) setTestCases([]);
    setShowSolution(['CODE_PYTHON','CODE_CPP','CODE_DEBUG_PYTHON','CODE_DEBUG_CPP'].includes(t));
  }

  // ── Option helpers ─────────────────────────────────────────

  function toggleCorrect(i: number) {
    if (type === 'MULTIPLE_CHOICE_SINGLE') {
      setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: j === i })));
    } else if (type === 'TRUE_FALSE_MULTI') {
      setOptions((prev) => prev.map((o, j) => j === i ? { ...o, isCorrect: !o.isCorrect } : o));
    } else {
      setOptions((prev) => prev.map((o, j) => j === i ? { ...o, isCorrect: !o.isCorrect } : o));
    }
  }

  function updateOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, j) => j === i ? { ...o, content: val } : o));
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

  // ── Parsons: parse code into lines ────────────────────────

  function handleParseLines() {
    const lines = parsonsCode.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) { toast.error('Cần ít nhất 2 dòng code.'); return; }
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
        return [...prev, ...Array.from({ length: blanks - prev.length }, () => ({ content: '', isCorrect: true }))];
      return prev.slice(0, blanks);
    });
  }

  // ── Test case helpers ──────────────────────────────────────

  function addTestCase() {
    setTestCases((prev) => [...prev, { input: '', expectedOutput: '', isHidden: true, points: 1 }]);
  }

  function updateTC(i: number, field: keyof TCInput, val: string | boolean | number) {
    setTestCases((prev) => prev.map((tc, j) => j === i ? { ...tc, [field]: val } : tc));
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
    const lang: 'PYTHON3' | 'CPP17' = (type === 'CODE_PYTHON' || type === 'CODE_DEBUG_PYTHON') ? 'PYTHON3' : 'CPP17';
    setTcGenerating((prev) => ({ ...prev, [tcIndex]: true }));
    try {
      const res = await runSolutionCodeForTCAction(
        solutionCode,
        lang,
        tc.input,
        Number(timeLimit) || 3,
        (Number(memoryLimit) || 256) * 1024,
      );
      if (res.success) {
        updateTC(tcIndex, 'expectedOutput', res.output);
        toast.success('Đã sinh expected output.');
      } else {
        toast.error(res.error);
      }
    } finally {
      setTcGenerating((prev) => ({ ...prev, [tcIndex]: false }));
    }
  }

  // ── Validate ───────────────────────────────────────────────

  function validate(): string | null {
    if (!content.trim()) return 'Nội dung câu hỏi không được để trống.';
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
    if (err) { toast.error(err); return; }
    if (pending) return;

    const isCode   = type === 'CODE_PYTHON' || type === 'CODE_CPP' || type === 'CODE_WEB';
    const isDebug  = type === 'CODE_DEBUG_PYTHON' || type === 'CODE_DEBUG_CPP';
    const baseVals = {
      type,
      content:     content.trim(),
      explanation: explanation.trim() || null,
      points:      Number(points) || 1,
      categoryId:  question?.categoryId ?? defaultCategoryId ?? null,
    };

    let values: QuestionFormValues;
    if (type === 'PARSONS') {
      values = { ...baseVals, options, testCases: [], starterCode: null, solutionCode: null, timeLimit: null, memoryLimit: null };
    } else if (type === 'CODE_FILL') {
      values = { ...baseVals, options, testCases: [], starterCode: starterCode || null, solutionCode: null, timeLimit: null, memoryLimit: null };
    } else if (isDebug) {
      values = {
        ...baseVals, options: [],
        testCases:   testCases.map((tc, i) => ({ ...tc, position: i })),
        starterCode:  starterCode || null,
        solutionCode: solutionCode || null,
        timeLimit:    Number(timeLimit) || 3,
        memoryLimit:  (Number(memoryLimit) || 256) * 1024,
      };
    } else {
      values = {
        ...baseVals,
        options:     isCode ? [] : options,
        testCases:   isCode ? testCases.map((tc, i) => ({ ...tc, position: i })) : [],
        starterCode:  isCode ? (starterCode || null)  : null,
        solutionCode: isCode ? (solutionCode || null) : null,
        timeLimit:    isCode && type !== 'CODE_WEB' ? (Number(timeLimit) || 3) : null,
        memoryLimit:  isCode && type !== 'CODE_WEB' ? (Number(memoryLimit) * 1024 || 262144) : null,
      };
    }

    setPending(true);
    try {
      const res = question
        ? await updateQuestionAction(question.id, values)
        : await createQuestionAction(courseId, values);

      if (res.success) {
        toast.success(res.message);
        router.push(returnTo ?? `/courses/${courseSlug}/questions`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi không mong muốn. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  const isMCQ       = type === 'MULTIPLE_CHOICE_SINGLE' || type === 'MULTIPLE_CHOICE_MULTIPLE';
  const isTF        = type === 'TRUE_FALSE';
  const isTFMulti   = type === 'TRUE_FALSE_MULTI';
  const isEssay     = type === 'ESSAY';
  const isParsons   = type === 'PARSONS';
  const isCodeFill  = type === 'CODE_FILL';
  const isDebugType = type === 'CODE_DEBUG_PYTHON' || type === 'CODE_DEBUG_CPP';
  const isCodeType  = type === 'CODE_PYTHON' || type === 'CODE_CPP' || type === 'CODE_WEB';
  const isAutoGraded = isCodeType || isDebugType;
  const codeEditorLang = CODE_LANG_MAP[type];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Loại câu hỏi</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(TYPE_LABEL) as QType[]).map((t) => (
            <button
              key={t}
              onClick={() => !question && handleTypeChange(t)}
              disabled={!!question}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors',
                type === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
                question && 'cursor-default opacity-70',
              )}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {question && <p className="text-xs text-muted-foreground">Không thể thay đổi loại câu hỏi sau khi tạo.</p>}
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isTFMulti ? 'Nội dung / Ngữ cảnh câu hỏi' : 'Nội dung câu hỏi'}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isTFMulti ? 'Nhập ngữ cảnh / đề bài (các phát biểu bên dưới)...' : 'Nhập câu hỏi...'}
          rows={isTFMulti ? 4 : 3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {/* MCQ options */}
      {isMCQ && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Đáp án {type === 'MULTIPLE_CHOICE_SINGLE' ? '(chọn 1 đúng)' : '(chọn nhiều đúng)'}
          </label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => toggleCorrect(i)}
                  className={cn(
                    'shrink-0 transition-colors',
                    o.isCorrect ? 'text-green-500' : 'text-muted-foreground/40 hover:text-muted-foreground',
                  )}
                  title={o.isCorrect ? 'Đáp án đúng' : 'Đánh dấu đúng'}
                >
                  {o.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
                <input
                  value={o.content}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Đáp án ${String.fromCharCode(65 + i)}...`}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm đáp án
            </button>
          )}
        </div>
      )}

      {/* TRUE_FALSE */}
      {isTF && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Đáp án đúng</label>
          <div className="flex gap-3">
            {options.map((o, i) => (
              <button
                key={i}
                onClick={() => setOptions(options.map((opt, j) => ({ ...opt, isCorrect: j === i })))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  o.isCorrect
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {o.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
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
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Các phát biểu (đánh dấu phát biểu nào là Đúng)
            </label>
            <span className="text-xs text-muted-foreground">{options.length} phát biểu</span>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                <span className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {String.fromCharCode(97 + i)}
                </span>
                <input
                  value={o.content}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Phát biểu ${String.fromCharCode(97 + i)}...`}
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setOptions(options.map((opt, j) => j === i ? { ...opt, isCorrect: true } : opt))}
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-medium transition-colors',
                      o.isCorrect
                        ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600',
                    )}
                  >
                    Đúng
                  </button>
                  <button
                    onClick={() => setOptions(options.map((opt, j) => j === i ? { ...opt, isCorrect: false } : opt))}
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-medium transition-colors',
                      !o.isCorrect
                        ? 'border-red-400 bg-red-400/15 text-red-700 dark:text-red-400'
                        : 'border-border text-muted-foreground hover:border-red-400 hover:text-red-600',
                    )}
                  >
                    Sai
                  </button>
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="text-muted-foreground/40 hover:text-destructive ml-1">
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
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm phát biểu
            </button>
          )}
        </div>
      )}

      {/* ESSAY hint */}
      {isEssay && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Câu hỏi tự luận — học sinh nhập câu trả lời dạng văn bản, giáo viên chấm thủ công.
        </div>
      )}

      {/* PARSONS */}
      {isParsons && (
        <div className="space-y-5">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
            <strong>Sắp xếp code (Parsons)</strong> — Học sinh kéo thả các dòng code để sắp xếp đúng thứ tự.
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nhập toàn bộ code đúng</label>
              <select
                value={parsonsLang}
                onChange={(e) => setParsonsLang(e.target.value as typeof parsonsLang)}
                className="rounded border border-input bg-background px-2 py-0.5 text-xs focus:outline-none"
              >
                <option value="PYTHON3">Python</option>
                <option value="JAVASCRIPT">JavaScript</option>
                <option value="CPP17">C++</option>
              </select>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
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
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" /> Phân tách thành dòng
            </button>
          </div>
          {options.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Thứ tự đúng ({options.length} dòng)
              </label>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
                    <input
                      value={o.content}
                      onChange={(e) => updateOption(i, e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={() => moveOption(i, -1)} disabled={i === 0}
                      className="p-1 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => moveOption(i, 1)} disabled={i === options.length - 1}
                      className="p-1 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeOption(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addOption}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
            <strong>Điền vào chỗ trống</strong> — Dùng <code className="font-mono bg-violet-500/10 px-1 rounded">___</code> để đánh dấu chỗ cần điền.
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Template code (dùng ___ cho chỗ trống)
              </label>
              <select
                value={fillLang}
                onChange={(e) => setFillLang(e.target.value as typeof fillLang)}
                className="rounded border border-input bg-background px-2 py-0.5 text-xs focus:outline-none"
              >
                <option value="PYTHON3">Python</option>
                <option value="JAVASCRIPT">JavaScript</option>
                <option value="CPP17">C++</option>
              </select>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <CodeEditor
                value={starterCode}
                onChange={handleFillTemplateChange}
                language={fillLang}
                height={220}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Phát hiện <strong>{(starterCode.match(/___/g) ?? []).length}</strong> chỗ trống.
            </p>
          </div>
          {options.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Đáp án từng ô</label>
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
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">So sánh chính xác sau khi trim khoảng trắng.</p>
            </div>
          )}
        </div>
      )}

      {/* CODE_DEBUG */}
      {isDebugType && (
        <div className="space-y-5">
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-xs text-orange-700 dark:text-orange-400">
            <strong>Debug code</strong> — Cung cấp code có lỗi, học sinh sửa cho đúng. Chấm tự động qua test cases.
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code có lỗi (hiện cho học sinh)</label>
            <div className="rounded-xl border border-orange-500/40 overflow-hidden">
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code đúng (để sinh expected output)</label>
              <button type="button" onClick={() => setShowSolution((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0">
                {showSolution ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSolution ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showSolution && (
              <div className="rounded-xl border border-primary/40 ring-1 ring-primary/20 overflow-hidden">
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Giới hạn thời gian (giây)</label>
              <input type="number" min={1} max={30} step={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Giới hạn bộ nhớ (MB)</label>
              <input type="number" min={32} max={512} step={32} value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Test cases</label>
              <span className="text-xs text-muted-foreground">{testCases.length} test case</span>
            </div>
            {testCases.map((tc, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Test #{i + 1}</span>
                  <div className="flex-1" />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={tc.isHidden} onChange={(e) => updateTC(i, 'isHidden', e.target.checked)} className="rounded" />
                    Ẩn khỏi học sinh
                  </label>
                  <input type="number" min={0} step={0.5} value={tc.points}
                    onChange={(e) => updateTC(i, 'points', parseFloat(e.target.value) || 0)}
                    className="w-16 rounded border border-input bg-background px-2 py-0.5 text-xs text-center focus:outline-none" />
                  <span className="text-xs text-muted-foreground">điểm</span>
                  <button onClick={() => removeTC(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Input (stdin)</label>
                    <textarea value={tc.input} onChange={(e) => updateTC(i, 'input', e.target.value)}
                      placeholder="Dữ liệu đầu vào..." rows={3}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Expected output</label>
                      <button type="button" onClick={() => void generateExpectedOutput(i)} disabled={tcGenerating[i]}
                        className="flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors">
                        {tcGenerating[i] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        {tcGenerating[i] ? 'Đang chạy...' : '⚡ Sinh'}
                      </button>
                    </div>
                    <textarea value={tc.expectedOutput} onChange={(e) => updateTC(i, 'expectedOutput', e.target.value)}
                      placeholder="Kết quả mong đợi..." rows={3}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y" />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addTestCase}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Code khởi đầu (hiện cho học sinh)
            </label>
            {codeEditorLang === 'WEB' ? (
              <WebCodeEditor value={starterCode} onChange={setStarterCode} height={320} />
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {type === 'CODE_PYTHON' || type === 'CODE_CPP'
                    ? 'Đáp án (code mẫu — dùng để sinh expected output)'
                    : 'Code mẫu (chỉ giáo viên xem)'}
                </label>
                {(type === 'CODE_PYTHON' || type === 'CODE_CPP') && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Viết code đúng ở đây, rồi ấn ⚡ Sinh ở từng test case để tự sinh expected output.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowSolution((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {showSolution ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSolution ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {showSolution && (
              codeEditorLang === 'WEB' ? (
                <WebCodeEditor value={solutionCode} onChange={setSolutionCode} height={320} />
              ) : (
                <div className={cn(
                  'rounded-xl border overflow-hidden',
                  type === 'CODE_PYTHON' || type === 'CODE_CPP'
                    ? 'border-primary/40 ring-1 ring-primary/20'
                    : 'border-border',
                )}>
                  <CodeEditor
                    value={solutionCode}
                    onChange={setSolutionCode}
                    language={codeEditorLang ?? 'PYTHON3'}
                    height={220}
                  />
                </div>
              )
            )}
          </div>

          {/* Time / Memory limits (non-WEB only) */}
          {type !== 'CODE_WEB' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Giới hạn thời gian (giây)
                </label>
                <input
                  type="number" min={1} max={30} step={1}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Giới hạn bộ nhớ (MB)
                </label>
                <input
                  type="number" min={32} max={512} step={32}
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Test cases (non-WEB only for auto-grading) */}
          {type !== 'CODE_WEB' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Test cases (tự chấm điểm)
                </label>
                <span className="text-xs text-muted-foreground">{testCases.length} test case</span>
              </div>
              {testCases.map((tc, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Test #{i + 1}</span>
                    <div className="flex-1" />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tc.isHidden}
                        onChange={(e) => updateTC(i, 'isHidden', e.target.checked)}
                        className="rounded"
                      />
                      Ẩn khỏi học sinh
                    </label>
                    <input
                      type="number" min={0} step={0.5}
                      value={tc.points}
                      onChange={(e) => updateTC(i, 'points', parseFloat(e.target.value) || 0)}
                      className="w-16 rounded border border-input bg-background px-2 py-0.5 text-xs text-center focus:outline-none"
                      title="Điểm"
                    />
                    <span className="text-xs text-muted-foreground">điểm</span>
                    <button onClick={() => removeTC(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Input (stdin)</label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => updateTC(i, 'input', e.target.value)}
                        placeholder="Dữ liệu đầu vào..."
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase">Expected output</label>
                        <button
                          type="button"
                          onClick={() => void generateExpectedOutput(i)}
                          disabled={tcGenerating[i]}
                          className="flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                          title="Chạy code đáp án với input này để sinh expected output"
                        >
                          {tcGenerating[i]
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Zap className="h-3 w-3" />
                          }
                          {tcGenerating[i] ? 'Đang chạy...' : '⚡ Sinh'}
                        </button>
                      </div>
                      <textarea
                        value={tc.expectedOutput}
                        onChange={(e) => updateTC(i, 'expectedOutput', e.target.value)}
                        placeholder="Kết quả mong đợi (hoặc ấn ⚡ Sinh)..."
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addTestCase}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isAutoGraded && type !== 'CODE_WEB' ? 'Điểm (phân bổ qua test cases)' : 'Điểm mặc định'}
          </label>
          <input
            type="number" min={0} step={0.5}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Giải thích (hiện sau khi nộp bài — tuỳ chọn)
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Giải thích đáp án đúng..."
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Huỷ</Button>
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? 'Đang lưu...' : question ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
        </Button>
      </div>
    </div>
  );
}
