'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, FileQuestion, Loader2, Plus, Save, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { PracticeQuestionInput, PracticeTestDetail, PracticeTestFile } from '@lumibach/types';

type Props = {
  mode: 'create' | 'edit';
  courseId: string;
  courseSlug: string;
  moduleId?: string;
  practiceTest?: PracticeTestDetail;
};

const LETTERS = 'ABCDEFGH'.split('');
const TF_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const FIELD_INPUT =
  'border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none';

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Thang điểm chuẩn đề thi 2025 cho câu Đúng/Sai 4 ý (tỉ lệ theo điểm tối đa):
// 1 đúng = 0.1 · 2 đúng = 0.25 · 3 đúng = 0.5 · 4 đúng = 1.0 (= điểm tối đa).
const TF4_RATIOS = [0, 0.1, 0.25, 0.5, 1];

function buildDefaultTfScores(statementCount: number, points: number) {
  if (statementCount === 4) {
    return TF4_RATIOS.map((ratio) => round2(ratio * points));
  }
  return Array.from({ length: statementCount + 1 }, (_, correctCount) =>
    statementCount > 0 ? round2((correctCount / statementCount) * points) : 0
  );
}

function normalizeTfScores(scores: number[] | undefined, statementCount: number, points: number) {
  const fallback = buildDefaultTfScores(statementCount, points);
  return fallback.map((fallbackScore, correctCount) => {
    if (correctCount === 0) return 0;
    const score = Number(scores?.[correctCount]);
    if (!Number.isFinite(score)) return fallbackScore;
    return round2(Math.min(points, Math.max(0, score)));
  });
}

function toInputValue(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function answerKeyToQuestion(q: PracticeTestDetail['questions'][number]): PracticeQuestionInput {
  const correct = q.correctAnswer ?? {};
  if (q.type === 'MULTIPLE_CHOICE') {
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      optionCount: q.optionCount || 4,
      correctOption: 'option' in correct ? String(correct.option) : 'A',
    };
  }
  if (q.type === 'TRUE_FALSE_MULTI') {
    return {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      statementCount: q.statementCount || 4,
      correctStatements:
        'statements' in correct && Array.isArray(correct.statements)
          ? correct.statements.map(Boolean)
          : Array.from({ length: q.statementCount || 4 }, () => true),
      scoreByCorrectCount:
        'scoreByCorrectCount' in correct && Array.isArray(correct.scoreByCorrectCount)
          ? correct.scoreByCorrectCount.map(Number)
          : buildDefaultTfScores(q.statementCount || 4, q.points || 1),
    };
  }
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    acceptedAnswers:
      'answers' in correct && Array.isArray(correct.answers) ? correct.answers.map(String) : [''],
    caseSensitive: q.caseSensitive,
  };
}

function makeMcq(): PracticeQuestionInput {
  return {
    type: 'MULTIPLE_CHOICE',
    points: 0.25,
    optionCount: 4,
    correctOption: 'A',
  };
}

function makeTf(): PracticeQuestionInput {
  return {
    type: 'TRUE_FALSE_MULTI',
    points: 1,
    statementCount: 4,
    correctStatements: [true, true, true, true],
    scoreByCorrectCount: buildDefaultTfScores(4, 1),
  };
}

function makeShort(): PracticeQuestionInput {
  return {
    type: 'SHORT_ANSWER',
    points: 0.5,
    acceptedAnswers: [''],
    caseSensitive: false,
  };
}

function splitQuestions(questions: PracticeQuestionInput[]) {
  return {
    mcq: questions.filter((q) => q.type === 'MULTIPLE_CHOICE'),
    tf: questions.filter((q) => q.type === 'TRUE_FALSE_MULTI'),
    short: questions.filter((q) => q.type === 'SHORT_ANSWER'),
  };
}

function formatBytes(size: number) {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function PracticeTestForm({ mode, courseId, courseSlug, moduleId, practiceTest }: Props) {
  const router = useRouter();
  const initialQuestions = practiceTest?.questions.map(answerKeyToQuestion) ?? [
    makeMcq(),
    makeMcq(),
    makeTf(),
    makeShort(),
  ];

  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(practiceTest?.title ?? '');
  const [description, setDescription] = useState(practiceTest?.description ?? '');
  const [timeLimit, setTimeLimit] = useState(
    practiceTest?.timeLimit != null ? String(practiceTest.timeLimit) : ''
  );
  const [maxAttempts, setMaxAttempts] = useState(
    practiceTest?.maxAttempts != null ? String(practiceTest.maxAttempts) : ''
  );
  const [showResults, setShowResults] = useState(practiceTest?.showResults ?? true);
  const [availableFrom, setAvailableFrom] = useState(toInputValue(practiceTest?.availableFrom));
  const [dueDate, setDueDate] = useState(toInputValue(practiceTest?.dueDate));
  const [pdfFile, setPdfFile] = useState<PracticeTestFile | null>(
    practiceTest
      ? {
          url: practiceTest.pdfUrl,
          name: practiceTest.pdfName,
          mimeType: practiceTest.pdfMimeType,
          size: practiceTest.pdfSize,
        }
      : null
  );
  const [questions, setQuestions] = useState<PracticeQuestionInput[]>(initialQuestions);

  const grouped = useMemo(() => splitQuestions(questions), [questions]);
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions]
  );

  function rebuildCounts(type: PracticeQuestionInput['type'], count: number) {
    const safeCount = Math.max(0, Math.min(80, Math.floor(count || 0)));
    const groupedNow = splitQuestions(questions);
    const current =
      groupedNow[type === 'MULTIPLE_CHOICE' ? 'mcq' : type === 'TRUE_FALSE_MULTI' ? 'tf' : 'short'];
    const maker =
      type === 'MULTIPLE_CHOICE' ? makeMcq : type === 'TRUE_FALSE_MULTI' ? makeTf : makeShort;
    const nextForType = Array.from({ length: safeCount }, (_, index) => current[index] ?? maker());
    const next = [
      ...(type === 'MULTIPLE_CHOICE' ? nextForType : groupedNow.mcq),
      ...(type === 'TRUE_FALSE_MULTI' ? nextForType : groupedNow.tf),
      ...(type === 'SHORT_ANSWER' ? nextForType : groupedNow.short),
    ];
    setQuestions(next);
  }

  function updateQuestion(index: number, patch: Partial<PracticeQuestionInput>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Chỉ hỗ trợ file PDF.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('courseId', courseId);
      const res = await fetch('/api/upload/practice-test-pdf', { method: 'POST', body: form });
      const data = (await res.json()) as { file?: PracticeTestFile; error?: string };
      if (!res.ok || !data.file) throw new Error(data.error ?? 'Upload thất bại.');
      setPdfFile(data.file);
      toast.success('Đã tải PDF lên.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload thất bại.');
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(publish: boolean) {
    return {
      courseId,
      title: title.trim(),
      description: description.trim() || null,
      pdfUrl: pdfFile?.url,
      pdfName: pdfFile?.name,
      pdfMimeType: pdfFile?.mimeType,
      pdfSize: pdfFile?.size,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      showResults,
      availableFrom: availableFrom || null,
      dueDate: dueDate || null,
      moduleId,
      publish,
      questions: questions.map((q) => {
        const points = Number(q.points) || 1;
        const statementCount = q.statementCount ?? 4;
        return {
          ...q,
          points,
          scoreByCorrectCount:
            q.type === 'TRUE_FALSE_MULTI'
              ? normalizeTfScores(q.scoreByCorrectCount, statementCount, points)
              : q.scoreByCorrectCount,
          acceptedAnswers: q.acceptedAnswers?.map((a) => a.trim()).filter(Boolean),
        };
      }),
    };
  }

  async function handleSave(publish: boolean) {
    if (!title.trim()) {
      toast.error('Tiêu đề không được để trống.');
      return;
    }
    if (!pdfFile) {
      toast.error('Cần tải file PDF đề bài.');
      return;
    }
    if (questions.length === 0) {
      toast.error('Cần ít nhất một câu trả lời.');
      return;
    }

    setPending(true);
    try {
      if (mode === 'create') {
        const data = await apiClient.post<{ practiceTestId: string }>(
          '/practice-tests',
          buildPayload(publish)
        );
        toast.success('Đã tạo đề luyện tập.');
        router.push(`/courses/${courseSlug}/practice-tests/${data.practiceTestId}`);
      } else {
        await apiClient.patch(`/practice-tests/${practiceTest!.id}`, buildPayload(publish));
        toast.success('Đã cập nhật đề luyện tập.');
        router.push(`/courses/${courseSlug}/practice-tests/${practiceTest!.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setPending(false);
    }
  }

  const backHref =
    mode === 'edit' && practiceTest
      ? `/courses/${courseSlug}/practice-tests/${practiceTest.id}`
      : `/courses/${courseSlug}/modules`;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
          <div className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-cyan-500" />
            <h1 className="text-2xl font-bold">
              {mode === 'create' ? 'Tạo đề luyện tập' : 'Chỉnh sửa đề luyện tập'}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            PDF ở bên trái, phiếu trả lời và đáp án tự chấm ở bên phải.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={pending || uploading}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Lưu nháp
          </Button>
          <Button onClick={() => handleSave(true)} disabled={pending || uploading}>
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-4 w-4" />
            )}
            Đăng hoạt động
          </Button>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold uppercase">Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đề luyện tập chương 1"
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold uppercase">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ghi chú ngắn cho học sinh..."
              className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thời gian (phút)">
              <input
                type="number"
                min={1}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="Không giới hạn"
                className={FIELD_INPUT}
              />
            </Field>
            <Field label="Số lần làm tối đa">
              <input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                placeholder="Không giới hạn"
                className={FIELD_INPUT}
              />
            </Field>
            <Field label="Mở từ">
              <input
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className={FIELD_INPUT}
              />
            </Field>
            <Field label="Hạn làm">
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={FIELD_INPUT}
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setShowResults(!showResults)}
            className="border-border bg-card flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Hiển thị đáp án sau khi nộp</span>
              <span className="text-muted-foreground text-xs">
                Học sinh sẽ thấy điểm và đáp án đúng ngay sau khi chấm.
              </span>
            </span>
            <span
              className={`relative h-6 w-11 rounded-full transition-colors ${showResults ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${showResults ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </span>
          </button>
        </div>

        <div className="border-border bg-card space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-semibold">File đề bài PDF</p>
            <p className="text-muted-foreground text-xs">
              File này sẽ được nhúng ở khung bên trái khi học sinh làm bài.
            </p>
          </div>
          <label className="border-border hover:border-primary/50 bg-muted/20 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors">
            {uploading ? (
              <Loader2 className="text-primary mb-2 h-8 w-8 animate-spin" />
            ) : (
              <UploadCloud className="text-muted-foreground mb-2 h-8 w-8" />
            )}
            <span className="text-sm font-semibold">
              {uploading ? 'Đang tải lên...' : 'Chọn file PDF'}
            </span>
            <span className="text-muted-foreground mt-1 text-xs">Tối đa 50 MB</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          {pdfFile && (
            <div className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pdfFile.name}</p>
                <p className="text-muted-foreground text-xs">{formatBytes(pdfFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPdfFile(null)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Gỡ PDF"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="border-border bg-card rounded-lg border">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold">Cấu trúc phiếu trả lời</h2>
            <p className="text-muted-foreground text-sm">
              Tổng {questions.length} câu, {totalPoints} điểm. Thứ tự: trắc nghiệm, đúng/sai nhiều
              phát biểu, trả lời ngắn.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CountControl
              label="Trắc nghiệm"
              value={grouped.mcq.length}
              onChange={(n) => rebuildCounts('MULTIPLE_CHOICE', n)}
            />
            <CountControl
              label="Đúng/Sai"
              value={grouped.tf.length}
              onChange={(n) => rebuildCounts('TRUE_FALSE_MULTI', n)}
            />
            <CountControl
              label="Trả lời ngắn"
              value={grouped.short.length}
              onChange={(n) => rebuildCounts('SHORT_ANSWER', n)}
            />
          </div>
        </div>

        <div className="space-y-6 p-4">
          <QuestionSection
            title="Trắc nghiệm lựa chọn"
            empty="Chưa có câu trắc nghiệm."
            questions={questions}
            type="MULTIPLE_CHOICE"
            render={(q, index, globalIndex) => (
              <div className="grid gap-3 md:grid-cols-[120px_1fr_120px] md:items-center">
                <input
                  type="number"
                  min={2}
                  max={4}
                  value={q.optionCount ?? 4}
                  onChange={(e) =>
                    updateQuestion(globalIndex, {
                      optionCount: Number(e.target.value),
                      correctOption: LETTERS.slice(0, Number(e.target.value)).includes(
                        q.correctOption ?? ''
                      )
                        ? q.correctOption
                        : 'A',
                    })
                  }
                  className={FIELD_INPUT}
                  aria-label={`Số lựa chọn câu ${index + 1}`}
                />
                <div className="flex flex-wrap gap-2">
                  {LETTERS.slice(0, q.optionCount ?? 4).map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => updateQuestion(globalIndex, { correctOption: letter })}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${
                        q.correctOption === letter
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:border-primary/50'
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
                <PointsInput
                  value={q.points}
                  onChange={(points) => updateQuestion(globalIndex, { points })}
                />
              </div>
            )}
          />

          <QuestionSection
            title="Đúng/Sai nhiều phát biểu"
            empty="Chưa có câu đúng/sai."
            questions={questions}
            type="TRUE_FALSE_MULTI"
            render={(q, index, globalIndex) => {
              const count = q.statementCount ?? 4;
              const points = Number(q.points) || 1;
              const answers = Array.from(
                { length: count },
                (_, i) => q.correctStatements?.[i] ?? true
              );
              const scores = normalizeTfScores(q.scoreByCorrectCount, count, points);
              return (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[160px_120px] md:items-center">
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={count}
                      onChange={(e) => {
                        const nextCount = Number(e.target.value);
                        updateQuestion(globalIndex, {
                          statementCount: nextCount,
                          correctStatements: Array.from(
                            { length: nextCount },
                            (_, i) => answers[i] ?? true
                          ),
                          scoreByCorrectCount: normalizeTfScores(
                            q.scoreByCorrectCount,
                            nextCount,
                            points
                          ),
                        });
                      }}
                      className={FIELD_INPUT}
                      aria-label={`Số phát biểu câu ${index + 1}`}
                    />
                    <PointsInput
                      value={q.points}
                      onChange={(nextPoints) => {
                        const nextScores = normalizeTfScores(
                          q.scoreByCorrectCount,
                          count,
                          nextPoints
                        );
                        nextScores[count] = nextPoints;
                        updateQuestion(globalIndex, {
                          points: nextPoints,
                          scoreByCorrectCount: nextScores,
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TF_LABELS.slice(0, count).map((label, statementIndex) => (
                      <div
                        key={label}
                        className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm font-semibold">{label})</span>
                        <div className="flex gap-1">
                          {[true, false].map((value) => (
                            <button
                              key={String(value)}
                              type="button"
                              onClick={() => {
                                const next = [...answers];
                                next[statementIndex] = value;
                                updateQuestion(globalIndex, { correctStatements: next });
                              }}
                              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                                answers[statementIndex] === value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {value ? 'Đúng' : 'Sai'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-border bg-muted/20 rounded-md border p-3">
                    <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                      Thang điểm theo số phát biểu đúng
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {Array.from({ length: count }, (_, i) => i + 1).map((correctCount) => (
                        <label key={correctCount} className="space-y-1">
                          <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                            Đúng {correctCount}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={points}
                            step={0.05}
                            value={scores[correctCount] ?? 0}
                            onChange={(e) => {
                              const next = [...scores];
                              next[correctCount] = Number(e.target.value);
                              updateQuestion(globalIndex, {
                                scoreByCorrectCount: normalizeTfScores(next, count, points),
                              });
                            }}
                            className={FIELD_INPUT}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }}
          />

          <QuestionSection
            title="Trả lời ngắn"
            empty="Chưa có câu trả lời ngắn."
            questions={questions}
            type="SHORT_ANSWER"
            render={(q, _index, globalIndex) => (
              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                <textarea
                  value={(q.acceptedAnswers ?? ['']).join('\n')}
                  onChange={(e) =>
                    updateQuestion(globalIndex, {
                      acceptedAnswers: e.target.value.split('\n'),
                    })
                  }
                  rows={3}
                  placeholder="Mỗi dòng là một đáp án được chấp nhận"
                  className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                />
                <div className="space-y-2">
                  <PointsInput
                    value={q.points}
                    onChange={(points) => updateQuestion(globalIndex, { points })}
                  />
                  <button
                    type="button"
                    onClick={() => updateQuestion(globalIndex, { caseSensitive: !q.caseSensitive })}
                    className={`w-full rounded-md border px-2 py-1.5 text-xs font-semibold ${
                      q.caseSensitive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Phân biệt hoa/thường
                  </button>
                </div>
              </div>
            )}
          />

          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, makeMcq()])}
            className="border-primary/40 text-primary hover:bg-primary/10 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Thêm nhanh 1 câu trắc nghiệm
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-semibold uppercase">{label}</span>
      {children}
    </label>
  );
}

function CountControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={80}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border-input bg-background focus:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus:ring-1 focus:outline-none"
      />
    </label>
  );
}

function PointsInput({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">Điểm</span>
      <input
        type="number"
        min={0.1}
        step={0.05}
        value={value ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className={FIELD_INPUT}
      />
    </label>
  );
}

function QuestionSection({
  title,
  empty,
  questions,
  type,
  render,
}: {
  title: string;
  empty: string;
  questions: PracticeQuestionInput[];
  type: PracticeQuestionInput['type'];
  render: (
    question: PracticeQuestionInput,
    sectionIndex: number,
    globalIndex: number
  ) => React.ReactNode;
}) {
  const rows = questions
    .map((question, globalIndex) => ({ question, globalIndex }))
    .filter((row) => row.question.type === type);

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">{title}</h3>
      {rows.length === 0 ? (
        <div className="border-border bg-muted/10 text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-sm">
          {empty}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ question, globalIndex }, index) => (
            <div
              key={`${type}-${globalIndex}`}
              className="border-border bg-background rounded-lg border p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Câu {index + 1}</p>
                <span className="text-muted-foreground text-xs">
                  {index + 1}/{rows.length}
                </span>
              </div>
              {render(question, index, globalIndex)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
