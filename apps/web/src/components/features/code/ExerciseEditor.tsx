'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { CodeLanguage } from '@lumibach/db';

const LANGUAGES: { key: CodeLanguage; label: string; icon: string }[] = [
  { key: 'PYTHON3', label: 'Python 3', icon: '/question_icon/python_icon.png' },
  { key: 'CPP17', label: 'C++ 17', icon: '/question_icon/cplusplus_icon.png' },
  { key: 'WEB', label: 'Web (HTML+CSS+JS)', icon: '/question_icon/web_icon_v2.png' },
];

type Props = {
  courseId: string;
  courseSlug: string;
  moduleId: string;
};

export function ExerciseEditor({ courseId, courseSlug, moduleId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<CodeLanguage>('PYTHON3');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    start(async () => {
      try {
        const res = await apiClient.post<{ exerciseId: string }>('/code-exercises', {
          courseId,
          title: title.trim(),
          language,
          moduleId,
        });
        toast.success('Đã tạo bài tập code!');
        router.push(`/courses/${courseSlug}/exercises/${res.exerciseId}/edit`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Code2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Tạo bài tập code</h2>
          <p className="text-muted-foreground text-sm">Chọn ngôn ngữ và đặt tiêu đề để bắt đầu</p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">
          Tiêu đề bài tập <span className="text-destructive">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Bài 1 – Tính tổng hai số nguyên"
          required
          autoFocus
          className="border-input bg-background focus:ring-ring w-full rounded-xl border px-4 py-2.5 text-sm focus:ring-2 focus:outline-none"
        />
      </div>

      {/* Language */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Ngôn ngữ lập trình</label>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLanguage(l.key)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all duration-150 ${
                language === l.key
                  ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                  : 'border-border bg-card hover:bg-muted/50 text-muted-foreground hover:border-violet-500/40'
              }`}
            >
              <Image
                src={l.icon}
                alt={l.label}
                width={32}
                height={32}
                style={{ width: 32, height: 32 }}
              />
              {l.label}
            </button>
          ))}
        </div>
        {language === 'WEB' && (
          <p className="text-muted-foreground mt-1 text-xs">
            Bài tập Web sẽ được chấm thủ công bởi giáo viên (không chấm tự động).
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="border-border flex items-center justify-between border-t pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Huỷ
        </button>
        <Button type="submit" disabled={pending || !title.trim()} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? 'Đang tạo...' : 'Tạo bài tập →'}
        </Button>
      </div>
    </form>
  );
}
