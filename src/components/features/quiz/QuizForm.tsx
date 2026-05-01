'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  createQuizAction,
  updateQuizAction,
  type QuizFormValues,
} from '@/actions/quizzes';
import type { QuizStatus } from '@prisma/client';

type ExistingQuiz = {
  id:               string;
  title:            string;
  description:      string | null;
  status:           QuizStatus;
  timeLimit:        number | null;
  maxAttempts:      number | null;
  passingScore:     number | null;
  shuffleQuestions: boolean;
  shuffleAnswers:   boolean;
  showResults:      boolean;
  availableFrom:    Date | null;
  dueDate:          Date | null;
};

type Props = {
  courseId:   string;
  courseSlug: string;
  quiz?:      ExistingQuiz;
  moduleId?:  string;
};

function toInputValue(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  // format as datetime-local value: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function QuizForm({ courseId, courseSlug, quiz, moduleId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [title,            setTitle]            = useState(quiz?.title ?? '');
  const [description,      setDescription]      = useState(quiz?.description ?? '');
  const [timeLimit,        setTimeLimit]        = useState(quiz?.timeLimit != null ? String(quiz.timeLimit) : '');
  const [maxAttempts,      setMaxAttempts]      = useState(quiz?.maxAttempts != null ? String(quiz.maxAttempts) : '');
  const [passingScore,     setPassingScore]     = useState(quiz?.passingScore != null ? String(quiz.passingScore) : '');
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz?.shuffleQuestions ?? false);
  const [shuffleAnswers,   setShuffleAnswers]   = useState(quiz?.shuffleAnswers ?? false);
  const [showResults,      setShowResults]      = useState(quiz?.showResults ?? true);
  const [availableFrom,    setAvailableFrom]    = useState(toInputValue(quiz?.availableFrom));
  const [dueDate,          setDueDate]          = useState(toInputValue(quiz?.dueDate));

  function buildValues(): QuizFormValues {
    return {
      title:            title.trim(),
      description:      description.trim() || null,
      timeLimit:        timeLimit ? Number(timeLimit) : null,
      maxAttempts:      maxAttempts ? Number(maxAttempts) : null,
      passingScore:     passingScore ? Number(passingScore) : null,
      shuffleQuestions,
      shuffleAnswers,
      showResults,
      availableFrom:    availableFrom || null,
      dueDate:          dueDate || null,
    };
  }

  async function handleSave(publish?: boolean) {
    if (!title.trim()) { toast.error('Tiêu đề không được để trống.'); return; }
    if (pending) return;
    setPending(true);
    try {
      if (quiz) {
        const res = await updateQuizAction(quiz.id, buildValues(), publish);
        if (res.success) {
          toast.success(res.message);
          router.push(`/courses/${courseSlug}/quizzes/${quiz.id}`);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createQuizAction(courseId, buildValues(), publish ?? false, moduleId);
        if (res.success) {
          toast.success(res.message);
          router.push(`/courses/${courseSlug}/quizzes/${res.data!.quizId}`);
        } else {
          toast.error(res.error);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi không mong muốn. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  const isPublished = quiz?.status === 'PUBLISHED';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tiêu đề *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên quiz..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mô tả (tuỳ chọn)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn về quiz..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {/* Time + attempts + passing */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Thời gian (phút)</label>
          <input
            type="number" min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="Không giới hạn"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Số lần làm tối đa</label>
          <input
            type="number" min={1}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            placeholder="Không giới hạn"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Điểm đạt (%)</label>
          <input
            type="number" min={0} max={100} step={0.5}
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            placeholder="Không yêu cầu"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mở từ</label>
          <input
            type="datetime-local"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hạn nộp</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Toggle options */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tuỳ chọn</p>
        {[
          { label: 'Trộn thứ tự câu hỏi',   value: shuffleQuestions, set: setShuffleQuestions },
          { label: 'Trộn thứ tự đáp án',     value: shuffleAnswers,   set: setShuffleAnswers },
          { label: 'Hiển thị kết quả sau khi nộp', value: showResults, set: setShowResults },
        ].map(({ label, value, set }) => (
          <label key={label} className="flex cursor-pointer items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={value}
              onClick={() => set(!value)}
              className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Huỷ</Button>
        <Button type="button" variant="outline" onClick={() => handleSave(false)} disabled={pending}>
          {pending ? 'Đang lưu...' : 'Lưu nháp'}
        </Button>
        <Button type="button" onClick={() => handleSave(isPublished ? undefined : true)} disabled={pending}>
          {pending ? 'Đang lưu...' : quiz ? 'Lưu thay đổi' : 'Tạo & Đăng'}
        </Button>
      </div>
    </div>
  );
}
