'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { toast } from 'sonner';
import { createAssignmentAction, updateAssignmentAction, type AssignmentFormValues } from '@/actions/assignments';
import { ChevronLeft, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Module = { id: string; name: string };

type Props =
  | { mode: 'create'; courseSlug: string; courseId: string; modules: Module[]; assignment?: undefined }
  | { mode: 'edit';   courseSlug: string; courseId: string; modules: Module[]; assignment: {
      id: string; title: string; instructions: string;
      type: string; status: string; maxScore: number; weight: number;
      availableFrom: Date | null; dueDate: Date | null; lateDeadline: Date | null;
      latePolicy: string; latePenalty: number | null;
      allowResubmit: boolean; maxAttempts: number | null;
    };
  };

function toInputDate(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function AssignmentForm({ mode, courseSlug, courseId, modules, assignment }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title,         setTitle]         = useState(assignment?.title         ?? '');
  const [instructions,  setInstructions]  = useState(assignment?.instructions  ?? '');
  const [type,          setType]          = useState(assignment?.type          ?? 'TEXT');
  const [maxScore,      setMaxScore]      = useState(String(assignment?.maxScore ?? 100));
  const [weight,        setWeight]        = useState(String(assignment?.weight  ?? 1));
  const [availableFrom, setAvailableFrom] = useState(toInputDate(assignment?.availableFrom));
  const [dueDate,       setDueDate]       = useState(toInputDate(assignment?.dueDate));
  const [lateDeadline,  setLateDeadline]  = useState(toInputDate(assignment?.lateDeadline));
  const [latePolicy,    setLatePolicy]    = useState(assignment?.latePolicy    ?? 'NONE');
  const [latePenalty,   setLatePenalty]   = useState(String(assignment?.latePenalty ?? ''));
  const [allowResubmit, setAllowResubmit] = useState(assignment?.allowResubmit ?? false);
  const [maxAttempts,   setMaxAttempts]   = useState(String(assignment?.maxAttempts ?? ''));
  const [moduleId,      setModuleId]      = useState('');

  function buildValues(): AssignmentFormValues {
    return {
      title, instructions, type: type as AssignmentFormValues['type'],
      maxScore: Number(maxScore), weight: Number(weight),
      availableFrom: availableFrom || null,
      dueDate:       dueDate       || null,
      lateDeadline:  lateDeadline  || null,
      latePolicy:    latePolicy    as AssignmentFormValues['latePolicy'],
      latePenalty:   latePenalty   ? Number(latePenalty)   : null,
      allowResubmit,
      maxAttempts:   maxAttempts   ? Number(maxAttempts)   : null,
      moduleId:      moduleId      || null,
    };
  }

  function handleSubmit(publish: boolean) {
    startTransition(async () => {
      const values = buildValues();
      const res = mode === 'create'
        ? await createAssignmentAction(courseId, values, publish)
        : await updateAssignmentAction(assignment!.id, values, publish ? true : undefined);

      if (res.success) {
        toast.success(res.message);
        if (mode === 'create' && res.data?.assignmentId) {
          router.push(`/courses/${courseSlug}/assignments/${res.data.assignmentId}`);
        } else {
          router.push(`/courses/${courseSlug}/assignments`);
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  const cancelHref = mode === 'edit'
    ? `/courses/${courseSlug}/assignments/${assignment!.id}`
    : `/courses/${courseSlug}/assignments`;

  return (
    <div>
      {/* ── Sticky bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-8 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <Link href={cancelHref} className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {mode === 'create' ? 'Bài tập' : 'Chi tiết'}
        </Link>
        <span className="mx-2 h-4 w-px bg-border" />
        <p className="flex-1 truncate text-sm font-medium text-muted-foreground">
          {title.trim() || (mode === 'create' ? 'Bài tập mới' : 'Chưa có tiêu đề')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(cancelHref)} disabled={pending}>Huỷ</Button>
          {mode === 'create' && (
            <Button type="button" variant="outline" size="sm" onClick={() => handleSubmit(false)} disabled={pending}>
              Lưu nháp
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => handleSubmit(true)} disabled={pending}>
            {pending ? 'Đang lưu...' : mode === 'create' ? 'Đăng bài tập' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-5xl">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề bài tập..."
          required
          className="w-full bg-transparent text-3xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/30"
        />

        {/* Settings row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kiểu nộp</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="TEXT">Văn bản</option>
              <option value="FILE">File đính kèm</option>
              <option value="BOTH">Văn bản + File</option>
            </select>
          </div>

          {/* Max score */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Điểm tối đa</label>
            <input
              type="number" min={0} max={10000} step={0.5}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trọng số (%)</label>
            <input
              type="number" min={0} max={100} step={0.5}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Late policy */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chính sách trễ</label>
            <select
              value={latePolicy}
              onChange={(e) => setLatePolicy(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="NONE">Không nhận</option>
              <option value="ALLOW">Nhận (không trừ)</option>
              <option value="DEDUCT">Trừ điểm</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <CalendarDays className="h-3.5 w-3.5" /> Mở từ
            </label>
            <input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5" /> Hạn nộp
            </label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5 text-destructive" /> Hạn trễ
            </label>
            <input type="datetime-local" value={lateDeadline} onChange={(e) => setLateDeadline(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={latePolicy === 'NONE'} />
          </div>
        </div>

        {/* Penalty + Resubmit */}
        <div className="flex flex-wrap items-center gap-6">
          {latePolicy === 'DEDUCT' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Trừ</span>
              <input
                type="number" min={0} max={100} step={0.5}
                value={latePenalty}
                onChange={(e) => setLatePenalty(e.target.value)}
                placeholder="0"
                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-muted-foreground">% / ngày trễ</span>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
            <input type="checkbox" checked={allowResubmit} onChange={(e) => setAllowResubmit(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary" />
            <span>Cho phép nộp lại</span>
            {allowResubmit && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Tối đa</span>
                <input
                  type="number" min={1} max={99}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  placeholder="∞"
                  className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-muted-foreground">lần</span>
              </>
            )}
          </label>
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <label className="text-sm font-semibold">Đề bài / Hướng dẫn</label>
          <RichTextEditor
            content={instructions}
            onChange={setInstructions}
            placeholder="Nhập đề bài, hướng dẫn nộp bài..."
            stickyToolbarOffset={56}
            compact
          />
        </div>

        {/* Module assignment (create only) */}
        {mode === 'create' && modules.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Thêm vào chương</label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Không thêm vào chương —</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Bottom save */}
        <div className={cn('flex items-center justify-end gap-2 border-t border-border pt-6', mode === 'create' ? '' : '')}>
          <Button type="button" variant="outline" onClick={() => router.push(cancelHref)} disabled={pending}>Huỷ</Button>
          {mode === 'create' && (
            <Button type="button" variant="outline" onClick={() => handleSubmit(false)} disabled={pending}>Lưu nháp</Button>
          )}
          <Button type="button" onClick={() => handleSubmit(true)} disabled={pending}>
            {pending ? 'Đang lưu...' : mode === 'create' ? 'Đăng bài tập' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>
    </div>
  );
}
