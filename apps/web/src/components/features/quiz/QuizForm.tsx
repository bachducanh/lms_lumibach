'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SebSettings, type SebConfig } from '@/components/features/seb/SebSettings';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type QuizFormValues = {
  title: string;
  description: string | null;
  timeLimit: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResults: boolean;
  availableFrom: string | null;
  dueDate: string | null;
  sebEnabled: boolean;
  sebConfigUrl: string | null;
  sebConfigName: string | null;
};
import type { QuizStatus } from '@lumibach/db';

type ExistingQuiz = {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  timeLimit: number | null;
  maxAttempts: number | null;
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResults: boolean;
  availableFrom: string | null;
  dueDate: string | null;
  sebEnabled: boolean;
  sebConfigUrl: string | null;
  sebConfigName: string | null;
};

type Props = {
  courseId: string;
  courseSlug: string;
  quiz?: ExistingQuiz;
  moduleId?: string;
};

function toInputValue(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  // format as datetime-local value: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function QuizForm({ courseId, courseSlug, quiz, moduleId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [timeLimit, setTimeLimit] = useState(quiz?.timeLimit != null ? String(quiz.timeLimit) : '');
  const [maxAttempts, setMaxAttempts] = useState(
    quiz?.maxAttempts != null ? String(quiz.maxAttempts) : ''
  );
  const [passingScore, setPassingScore] = useState(
    quiz?.passingScore != null ? String(quiz.passingScore) : ''
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz?.shuffleQuestions ?? false);
  const [shuffleAnswers, setShuffleAnswers] = useState(quiz?.shuffleAnswers ?? false);
  const [showResults, setShowResults] = useState(quiz?.showResults ?? true);
  const [availableFrom, setAvailableFrom] = useState(toInputValue(quiz?.availableFrom));
  const [dueDate, setDueDate] = useState(toInputValue(quiz?.dueDate));
  const [sebEnabled, setSebEnabled] = useState(quiz?.sebEnabled ?? false);
  const [sebConfig, setSebConfig] = useState<SebConfig>(
    quiz?.sebConfigUrl ? { url: quiz.sebConfigUrl, name: quiz.sebConfigName ?? 'config.seb' } : null
  );

  function buildValues(): QuizFormValues {
    return {
      title: title.trim(),
      description: description.trim() || null,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      passingScore: passingScore ? Number(passingScore) : null,
      shuffleQuestions,
      shuffleAnswers,
      showResults,
      availableFrom: availableFrom || null,
      dueDate: dueDate || null,
      sebEnabled,
      sebConfigUrl: sebEnabled ? (sebConfig?.url ?? null) : null,
      sebConfigName: sebEnabled ? (sebConfig?.name ?? null) : null,
    };
  }

  async function handleSave(publish?: boolean) {
    if (!title.trim()) {
      toast.error('Tiêu đề không được để trống.');
      return;
    }
    if (pending) return;
    setPending(true);
    try {
      if (quiz) {
        await apiClient.patch(`/quizzes/${quiz.id}`, { ...buildValues(), publish });
        toast.success('Đã cập nhật quiz.');
        router.push(`/courses/${courseSlug}/quizzes/${quiz.id}`);
      } else {
        const data = await apiClient.post<{ quizId: string }>('/quizzes', {
          courseId,
          ...buildValues(),
          publish: publish ?? false,
          moduleId,
        });
        toast.success('Đã tạo quiz.');
        router.push(`/courses/${courseSlug}/quizzes/${data.quizId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Có lỗi không mong muốn. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  const isPublished = quiz?.status === 'PUBLISHED';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Tiêu đề *
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên quiz..."
          className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Mô tả (tuỳ chọn)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn về quiz..."
          rows={3}
          className="border-input bg-background focus:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Time + attempts + passing */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Thời gian (phút)
          </label>
          <input
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="Không giới hạn"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Số lần làm tối đa
          </label>
          <input
            type="number"
            min={1}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            placeholder="Không giới hạn"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Điểm đạt (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
            placeholder="Không yêu cầu"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Mở từ
          </label>
          <input
            type="datetime-local"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Hạn nộp
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      {/* Toggle options */}
      <div className="border-border bg-muted/20 space-y-3 rounded-xl border p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Tuỳ chọn
        </p>
        {[
          { label: 'Trộn thứ tự câu hỏi', value: shuffleQuestions, set: setShuffleQuestions },
          { label: 'Trộn thứ tự đáp án', value: shuffleAnswers, set: setShuffleAnswers },
          { label: 'Hiển thị kết quả sau khi nộp', value: showResults, set: setShowResults },
        ].map(({ label, value, set }) => (
          <label key={label} className="flex cursor-pointer items-center gap-3">
            <Switch checked={value} onCheckedChange={set} />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      {/* Safe Exam Browser */}
      <SebSettings
        courseId={courseId}
        enabled={sebEnabled}
        onEnabledChange={setSebEnabled}
        config={sebConfig}
        onConfigChange={setSebConfig}
      />

      {/* Actions */}
      <div className="border-border flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Huỷ
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={pending}
        >
          {pending ? 'Đang lưu...' : 'Lưu nháp'}
        </Button>
        <Button
          type="button"
          onClick={() => handleSave(isPublished ? undefined : true)}
          disabled={pending}
        >
          {pending ? 'Đang lưu...' : quiz ? 'Lưu thay đổi' : 'Tạo & Đăng'}
        </Button>
      </div>
    </div>
  );
}
