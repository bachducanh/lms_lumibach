'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createExerciseAction } from '@/actions/exercises';
import type { CodeLanguage } from '@prisma/client';

const LANGUAGES: { key: CodeLanguage; label: string; icon: string }[] = [
  { key: 'PYTHON3', label: 'Python 3',         icon: '/question_icon/python_icon.png'    },
  { key: 'CPP17',   label: 'C++ 17',            icon: '/question_icon/cplusplus_icon.png' },
  { key: 'WEB',     label: 'Web (HTML+CSS+JS)', icon: '/question_icon/web_icon.png'       },
];

type Props = {
  courseId:   string;
  courseSlug: string;
  moduleId:   string;
};

export function ExerciseEditor({ courseId, courseSlug, moduleId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title,    setTitle]    = useState('');
  const [language, setLanguage] = useState<CodeLanguage>('PYTHON3');

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return; }
    start(async () => {
      const res = await createExerciseAction(courseId, { title: title.trim(), language, moduleId });
      if (!res.success) { toast.error(res.error); return; }
      toast.success('Đã tạo bài tập code!');
      router.push(`/courses/${courseSlug}/exercises/${res.exerciseId}/edit`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Code2 className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Tạo bài tập code</h2>
          <p className="text-sm text-muted-foreground">Chọn ngôn ngữ và đặt tiêu đề để bắt đầu</p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Tiêu đề bài tập <span className="text-destructive">*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Bài 1 – Tính tổng hai số nguyên"
          required
          autoFocus
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  : 'border-border bg-card hover:border-violet-500/40 hover:bg-muted/50 text-muted-foreground'
              }`}
            >
              <Image src={l.icon} alt={l.label} width={32} height={32} style={{ width: 32, height: 32 }} />
              {l.label}
            </button>
          ))}
        </div>
        {language === 'WEB' && (
          <p className="text-xs text-muted-foreground mt-1">
            Bài tập Web sẽ được chấm thủ công bởi giáo viên (không chấm tự động).
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
