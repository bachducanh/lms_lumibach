'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  BookOpen,
  CheckCircle2,
  Link2,
  X,
  ClipboardList,
  ExternalLink,
  FileQuestion,
  Brain,
  Sparkles,
  FolderOpen,
  Code2,
  Cat,
  ChevronDown,
  ChevronsUpDown,
  UsersRound,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiClient, ApiError } from '@/lib/api-client';
import type { ModuleWithItems } from '@lumibach/types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ActivityGroupModeButton } from './ActivityGroupModeButton';

type ModuleItem = ModuleWithItems['items'][number];

type Props = {
  courseSlug: string;
  courseId: string;
  modules: ModuleWithItems[];
  canManage: boolean;
  completedIds?: Set<string>;
  submittedAssignmentIds?: Set<string>;
  submittedQuizIds?: Set<string>;
  submittedPracticeTestIds?: Set<string>;
  submittedCodeExerciseIds?: Set<string>;
};

// ── Activity types shown in the picker modal ──────────────────

type ActivityDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  borderGlow: string;
};

const ACTIVITY_DEFS: ActivityDef[] = [
  {
    id: 'lesson',
    label: 'Bài học',
    description: 'Nội dung lý thuyết, video, tài liệu học tập',
    icon: <BookOpen className="h-7 w-7 text-teal-400" />,
    iconBg: 'bg-teal-500/10',
    borderGlow: 'hover:border-teal-500/40 hover:shadow-[0_0_15px_rgba(45,212,191,0.2)]',
  },
  {
    id: 'assignment',
    label: 'Bài tập',
    description: 'Giao bài tập, chấm điểm và nhận xét',
    icon: <ClipboardList className="h-7 w-7 text-blue-400" />,
    iconBg: 'bg-blue-500/10',
    borderGlow: 'hover:border-blue-500/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Kiểm tra nhanh bằng câu hỏi trắc nghiệm',
    icon: <Brain className="h-7 w-7 text-violet-400" />,
    iconBg: 'bg-violet-500/10',
    borderGlow: 'hover:border-violet-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]',
  },
  {
    id: 'practice_test',
    label: 'Đề luyện tập',
    description: 'Tải đề PDF, cấu hình phiếu trả lời và chấm tự động',
    icon: <FileQuestion className="h-7 w-7 text-cyan-400" />,
    iconBg: 'bg-cyan-500/10',
    borderGlow: 'hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]',
  },
  {
    id: 'code_exercise',
    label: 'Bài tập code',
    description: 'Lập trình Python, JavaScript, C++ hoặc Web có chấm tự động',
    icon: <Code2 className="h-7 w-7 text-fuchsia-400" />,
    iconBg: 'bg-fuchsia-500/10',
    borderGlow: 'hover:border-fuchsia-500/40 hover:shadow-[0_0_15px_rgba(217,70,239,0.2)]',
  },
  {
    id: 'scratch',
    label: 'Bài Scratch',
    description: 'Lập trình kéo thả Scratch ngay trong LMS, học sinh nộp project .sb3',
    icon: <Cat className="h-7 w-7 text-orange-400" />,
    iconBg: 'bg-orange-500/10',
    borderGlow: 'hover:border-orange-500/40 hover:shadow-[0_0_15px_rgba(251,146,60,0.2)]',
  },
  {
    id: 'external_url',
    label: 'Link ngoài',
    description: 'Liên kết tới tài nguyên bên ngoài',
    icon: <ExternalLink className="h-7 w-7 text-amber-400" />,
    iconBg: 'bg-amber-500/10',
    borderGlow: 'hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]',
  },
];

// ── Add activity modal ────────────────────────────────────────

type ModalProps = {
  courseSlug: string;
  moduleId: string;
  onClose: () => void;
  onSelectUrl: () => void;
};

function AddActivityModal({ courseSlug, moduleId, onClose, onSelectUrl }: ModalProps) {
  function handleSelect(id: string) {
    if (id === 'external_url') {
      onSelectUrl();
      onClose();
    }
  }

  const navHrefs: Record<string, string> = {
    lesson: `/courses/${courseSlug}/lessons/new?moduleId=${moduleId}`,
    assignment: `/courses/${courseSlug}/assignments/new?moduleId=${moduleId}`,
    quiz: `/courses/${courseSlug}/quizzes/new?moduleId=${moduleId}`,
    practice_test: `/courses/${courseSlug}/practice-tests/new?moduleId=${moduleId}`,
    code_exercise: `/courses/${courseSlug}/exercises/new?moduleId=${moduleId}`,
    scratch: `/courses/${courseSlug}/scratch/new?moduleId=${moduleId}`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div
        className="border-border/50 bg-card/90 relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{ boxShadow: '0 24px 64px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(1 0 0 / 10%)' }}
      >
        <div
          className="absolute top-0 right-0 left-0 h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgb(253 8 93 / 80%), oklch(0.80 0.13 210 / 0.6), transparent)',
          }}
        />

        <div className="border-border/50 bg-muted/20 flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="text-primary h-4 w-4" />
              Thêm hoạt động hoặc tài nguyên
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Chọn loại nội dung bạn muốn thêm vào chương này
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary hover:bg-muted rounded-md p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-6">
          {ACTIVITY_DEFS.map((act) => {
            const href = navHrefs[act.id];
            const inner = (
              <div
                className={`border-border/50 bg-card flex w-full cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${act.borderGlow} group hover:-translate-y-0.5`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${act.iconBg}`}
                >
                  {act.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="group-hover:text-foreground text-sm font-bold transition-colors">
                    {act.label}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {act.description}
                  </p>
                </div>
              </div>
            );

            if (href) {
              return (
                <Link key={act.id} href={href} onClick={onClose} className="flex">
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSelect(act.id)}
                className="flex text-left"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Inline editable module name ───────────────────────────────

function EditableModuleName({
  id,
  name,
  onSaved,
  editing,
  onEditingChange,
}: {
  id: string;
  name: string;
  onSaved: () => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing) setValue(name);
  }, [editing, name]);

  function save() {
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/${id}`, { name: value });
        toast.success('Đã cập nhật tên chương.');
        onEditingChange(false);
        onSaved();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật');
        setValue(name);
        onEditingChange(false);
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            setValue(name);
            onEditingChange(false);
          }
        }}
        disabled={pending}
        className="border-primary flex-1 border-b bg-transparent text-lg font-bold outline-none"
      />
    );
  }

  return (
    <h3
      className="hover:text-primary line-clamp-2 flex-1 cursor-pointer text-base font-bold transition-colors sm:text-lg"
      onClick={() => onEditingChange(true)}
    >
      {name}
    </h3>
  );
}

// ── Add module form ───────────────────────────────────────────

function AddModuleForm({
  courseId,
  onAdded,
  onCancel,
}: {
  courseId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await apiClient.post('/modules', { courseId, name });
        toast.success('Đã tạo chương mới.');
        setName('');
        onAdded();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi tạo chương');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card flex items-center gap-2 rounded-xl border p-4"
    >
      <FolderOpen className="text-muted-foreground h-5 w-5 shrink-0" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên chương mới (VD: Chương 1: Giới thiệu)..."
        required
        autoFocus
        className="placeholder:text-muted-foreground/50 flex-1 border-none bg-transparent px-2 text-sm font-semibold focus:ring-0 focus:outline-none"
      />
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Hủy
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgb(253_8_93_/_40%)]"
        >
          Lưu chương
        </Button>
      </div>
    </form>
  );
}

// ── Add external URL form ─────────────────────────────────────

function AddExternalUrlForm({
  moduleId,
  onAdded,
  onClose,
}: {
  moduleId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/${moduleId}/items`, {
          title,
          type: 'EXTERNAL_URL',
          externalUrl: url,
        });
        toast.success('Đã thêm link ngoài.');
        setTitle('');
        setUrl('');
        onAdded();
        onClose();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm link');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-primary/30 bg-primary/5 relative mt-2 space-y-3 overflow-hidden rounded-xl border p-4"
    >
      <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />
      <div className="mb-2 flex items-center justify-between">
        <span className="text-primary flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
          <ExternalLink className="h-3.5 w-3.5" />
          Thêm link ngoài
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Tài liệu tham khảo)"
        required
        className="border-border bg-card focus:ring-primary h-9 w-full rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (https://...)"
        type="url"
        required
        className="border-border bg-card focus:ring-primary h-9 w-full rounded-md border px-3 font-mono text-sm focus:ring-1 focus:outline-none"
      />
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Lưu link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

// ── Sortable item row ─────────────────────────────────────────

type ItemRowProps = {
  item: ModuleItem;
  courseSlug: string;
  courseId: string;
  canManage: boolean;
  isDone: boolean;
  onTogglePublish: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
};

function SortableItemRow({
  item,
  courseSlug,
  courseId,
  canManage,
  isDone,
  onTogglePublish,
  onDelete,
  onRefresh,
}: ItemRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const router = useRouter();
  const itemGroupMode = (item.groupMode ?? 'NO_GROUPS') as
    | 'NO_GROUPS'
    | 'VISIBLE_GROUPS'
    | 'SEPARATE_GROUPS';
  const itemGroupingId = item.groupingId ?? null;
  const itemVisibleGroupIds: string[] = item.visibleGroupIds ?? [];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canManage,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isExternalUrl = item.type === 'EXTERNAL_URL';
  const isAssignment = item.type === 'ASSIGNMENT';
  const isQuiz = item.type === 'QUIZ';
  const isPracticeTest = item.type === 'PRACTICE_TEST';
  const isCodeExercise = item.type === 'CODE_EXERCISE';
  const quizId = item.quiz?.id ?? item.quizId;
  const practiceTestId = item.practiceTest?.id ?? item.practiceTestId;
  const codeExId = item.codeExercise?.id ?? item.codeExerciseId;
  const codeExLang = item.codeExercise?.language;
  const isScratch = isCodeExercise && codeExLang === 'SCRATCH';
  const LANG_ICON: Record<string, string> = {
    PYTHON3: '/question_icon/python_icon.png',
    CPP17: '/question_icon/cplusplus_icon.png',
    WEB: '/question_icon/web_icon_v2.png',
  };

  // Left border + icon + badge colors by type
  const typeColors: Record<
    string,
    { border: string; bg: string; icon: string; text: string; glowColor: string; bgRgba: string }
  > = {
    lesson: {
      border: 'border-l-teal-500',
      bg: 'bg-teal-500/15',
      icon: 'text-teal-500',
      text: 'Bài học',
      glowColor: 'rgb(20, 184, 166)',
      bgRgba: 'rgba(20, 184, 166, 0.15)',
    },
    assignment: {
      border: 'border-l-blue-500',
      bg: 'bg-blue-500/15',
      icon: 'text-blue-500',
      text: 'Bài tập',
      glowColor: 'rgb(59, 130, 246)',
      bgRgba: 'rgba(59, 130, 246, 0.15)',
    },
    quiz: {
      border: 'border-l-violet-500',
      bg: 'bg-violet-500/15',
      icon: 'text-violet-500',
      text: 'Quiz',
      glowColor: 'rgb(139, 92, 246)',
      bgRgba: 'rgba(139, 92, 246, 0.15)',
    },
    practice: {
      border: 'border-l-cyan-500',
      bg: 'bg-cyan-500/15',
      icon: 'text-cyan-500',
      text: 'Đề luyện tập',
      glowColor: 'rgb(6, 182, 212)',
      bgRgba: 'rgba(6, 182, 212, 0.15)',
    },
    code: {
      border: 'border-l-fuchsia-500',
      bg: 'bg-fuchsia-500/15',
      icon: 'text-fuchsia-500',
      text: 'Bài tập code',
      glowColor: 'rgb(217, 70, 239)',
      bgRgba: 'rgba(217, 70, 239, 0.15)',
    },
    scratch: {
      border: 'border-l-orange-500',
      bg: 'bg-orange-500/15',
      icon: 'text-orange-500',
      text: 'Bài Scratch',
      glowColor: 'rgb(251, 146, 60)',
      bgRgba: 'rgba(251, 146, 60, 0.15)',
    },
    external: {
      border: 'border-l-amber-500',
      bg: 'bg-amber-500/15',
      icon: 'text-amber-500',
      text: 'Link ngoài',
      glowColor: 'rgb(245, 158, 11)',
      bgRgba: 'rgba(245, 158, 11, 0.15)',
    },
  };

  let typeKey: keyof typeof typeColors = 'lesson';
  if (isExternalUrl) typeKey = 'external';
  else if (isAssignment) typeKey = 'assignment';
  else if (isQuiz) typeKey = 'quiz';
  else if (isPracticeTest) typeKey = 'practice';
  else if (isScratch) typeKey = 'scratch';
  else if (isCodeExercise) typeKey = 'code';

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const colors = typeColors[typeKey]!;
  const editHref = item.lessonId
    ? `/courses/${courseSlug}/lessons/${item.lessonId}/edit`
    : item.assignmentId
      ? `/courses/${courseSlug}/assignments/${item.assignmentId}/edit`
      : isQuiz && quizId
        ? `/courses/${courseSlug}/quizzes/${quizId}/edit`
        : isPracticeTest && practiceTestId
          ? `/courses/${courseSlug}/practice-tests/${practiceTestId}/edit`
          : isCodeExercise && codeExId
            ? isScratch
              ? `/courses/${courseSlug}/scratch/${codeExId}/edit`
              : `/courses/${courseSlug}/exercises/${codeExId}/edit`
            : null;

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...style,
        ...(isHovered &&
          !isDragging && {
            backgroundColor: colors.bgRgba,
            boxShadow: `0 0 0 1.5px ${colors.glowColor}40, inset 0 0 0 0.5px ${colors.glowColor}30, 0 0 25px ${colors.glowColor}15`,
          }),
      }}
      className={`relative flex items-center gap-2.5 border-l-4 ${colors.border} bg-card group/item overflow-hidden rounded-r-lg px-3 py-3 transition-all duration-200 sm:gap-3 sm:px-4 sm:py-3.5 ${isDragging ? 'ring-primary/30 z-50 scale-95 opacity-40 shadow-xl ring-2' : 'hover:-translate-x-0.5 hover:shadow-md'}`}
    >
      {/* Drag handle */}
      {canManage && (
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground/70 flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center transition-colors active:cursor-grabbing sm:w-6"
          tabIndex={-1}
          aria-label="Kéo để sắp xếp"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Icon with colored background */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 ${colors.bg} border border-current/10 shadow-sm transition-transform group-hover/item:scale-110`}
      >
        {isExternalUrl ? (
          <Link2 className={`h-5 w-5 ${colors.icon}`} />
        ) : isAssignment ? (
          <ClipboardList className={`h-5 w-5 ${colors.icon}`} />
        ) : isQuiz ? (
          <Brain className={`h-5 w-5 ${colors.icon}`} />
        ) : isPracticeTest ? (
          <FileQuestion className={`h-5 w-5 ${colors.icon}`} />
        ) : isScratch ? (
          <Cat className={`h-5 w-5 ${colors.icon}`} />
        ) : isCodeExercise && codeExLang && LANG_ICON[codeExLang] ? (
          <Image
            src={LANG_ICON[codeExLang]}
            alt={codeExLang}
            width={24}
            height={24}
            className="object-contain"
          />
        ) : isCodeExercise ? (
          <Code2 className={`h-5 w-5 ${colors.icon}`} />
        ) : (
          <BookOpen className={`h-5 w-5 ${colors.icon}`} />
        )}
      </div>

      {/* Title link */}
      <div className="min-w-0 flex-1">
        {isExternalUrl && item.externalUrl ? (
          <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </a>
        ) : isAssignment && item.assignmentId ? (
          <Link href={`/courses/${courseSlug}/assignments/${item.assignmentId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </Link>
        ) : isQuiz && quizId ? (
          <Link href={`/courses/${courseSlug}/quizzes/${quizId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </Link>
        ) : isPracticeTest && practiceTestId ? (
          <Link href={`/courses/${courseSlug}/practice-tests/${practiceTestId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </Link>
        ) : isCodeExercise && codeExId ? (
          <Link
            href={
              isScratch
                ? `/courses/${courseSlug}/scratch/${codeExId}`
                : `/courses/${courseSlug}/exercises/${codeExId}`
            }
            className="block"
          >
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </Link>
        ) : item.lessonId ? (
          <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            {item.lesson?.estimatedMinutes && (
              <p className="text-muted-foreground/70 text-xs">
                ⏱ {item.lesson.estimatedMinutes} phút
              </p>
            )}
          </Link>
        ) : (
          <div className="block">
            <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
            <p className="text-muted-foreground/70 text-xs">{colors.text}</p>
          </div>
        )}
      </div>

      {/* Right side - Status badges and actions */}
      <div className="flex shrink-0 items-center gap-2">
        {isDone && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20"
            title="Đã hoàn thành"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
        )}
        {!item.isPublished && (
          <Badge
            variant="outline"
            className="bg-muted/70 text-[9px] font-bold tracking-widest uppercase"
          >
            Ẩn
          </Badge>
        )}

        {/* Teacher actions toolbar */}
        {canManage && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label="Mở menu thao tác"
                className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none sm:hidden"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {editHref && (
                  <DropdownMenuItem onClick={() => router.push(editHref)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Chỉnh sửa
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setGroupDialogOpen(true);
                  }}
                >
                  <UsersRound className="mr-2 h-4 w-4" />
                  Cài đặt nhóm
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onTogglePublish(item.id)}>
                  {item.isPublished ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {item.isPublished ? 'Ẩn' : 'Hiển thị'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  variant="destructive"
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xoá
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Controlled dialog: cài đặt nhóm — share giữa mobile menu item và desktop button */}
            <ActivityGroupModeButton
              courseId={courseId}
              moduleItemId={item.id}
              currentMode={itemGroupMode}
              currentGroupingId={itemGroupingId}
              currentGroupIds={itemVisibleGroupIds}
              showTrigger={false}
              open={groupDialogOpen}
              onOpenChange={setGroupDialogOpen}
              onChanged={onRefresh}
            />

            <div className="hidden items-center gap-0.5 transition-opacity sm:flex sm:opacity-0 sm:group-hover/item:opacity-100">
              {editHref && (
                <Link
                  href={editHref}
                  title="Chỉnh sửa"
                  className="text-muted-foreground hover:text-primary hover:bg-muted rounded-md p-1.5 transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setGroupDialogOpen(true)}
                title="Cài đặt nhóm"
                className="text-muted-foreground hover:text-primary hover:bg-muted rounded-md p-1.5 transition-all"
              >
                <UsersRound className="h-3.5 w-3.5" />
              </button>
              <div className="bg-border/30 mx-0.5 h-5 w-px" />
              <button
                onClick={() => onTogglePublish(item.id)}
                title={item.isPublished ? 'Ẩn' : 'Hiển thị'}
                className={`rounded-md p-1.5 transition-all ${item.isPublished ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {item.isPublished ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => onDelete(item.id)}
                title="Xoá"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sortable module row ───────────────────────────────────────

type ModuleRowProps = {
  mod: ModuleWithItems;
  courseSlug: string;
  courseId: string;
  canManage: boolean;
  completedIds?: Set<string>;
  submittedAssignmentIds?: Set<string>;
  submittedQuizIds?: Set<string>;
  submittedPracticeTestIds?: Set<string>;
  submittedCodeExerciseIds?: Set<string>;
  openUrlFormId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePublish: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onAddActivity: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onToggleItemPublish: (id: string) => void;
  onOpenUrlForm: (id: string | null) => void;
  onRefresh: () => void;
};

function SortableModuleRow({
  mod,
  courseSlug,
  courseId,
  canManage,
  completedIds,
  submittedAssignmentIds,
  submittedQuizIds,
  submittedPracticeTestIds,
  submittedCodeExerciseIds,
  openUrlFormId,
  isCollapsed,
  onToggleCollapse,
  onTogglePublish,
  onDelete,
  onAddActivity,
  onDeleteItem,
  onToggleItemPublish,
  onOpenUrlForm,
  onRefresh,
}: ModuleRowProps) {
  const [, startItemTransition] = useTransition();
  const [isEditingName, setIsEditingName] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
    disabled: !canManage,
  });

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [localItems, setLocalItems] = useState<ModuleItem[]>(mod.items);
  useEffect(() => {
    setLocalItems(mod.items);
  }, [mod.items]);

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(reordered);
    startItemTransition(async () => {
      try {
        await apiClient.patch(`/modules/${mod.id}/items/reorder`, {
          orderedIds: reordered.map((i) => i.id),
        });
        onRefresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi sắp xếp');
      }
    });
  }

  const outerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: '0 4px 20px oklch(0 0 0 / 0.2)',
  };

  return (
    <div
      ref={setNodeRef}
      style={outerStyle}
      className={`border-border bg-card group/module overflow-hidden rounded-lg border transition-all duration-200 ${isDragging ? 'ring-primary/20 opacity-40 shadow-xl ring-2' : 'hover:border-primary/30 hover:shadow-md'}`}
    >
      {/* Module Header */}
      <div className="bg-card border-border/50 hover:bg-muted/20 flex items-center gap-2 border-b px-3 py-3.5 transition-colors sm:gap-3 sm:px-5 sm:py-5">
        {/* Drag handle */}
        {canManage && (
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground/40 hover:text-muted-foreground/70 flex h-8 w-5 cursor-grab touch-none items-center justify-center transition-colors active:cursor-grabbing"
            tabIndex={-1}
            aria-label="Kéo để sắp xếp chương"
          >
            <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          title={isCollapsed ? 'Mở rộng chương' : 'Thu gọn chương'}
        >
          <ChevronDown
            className={`text-muted-foreground h-5 w-5 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
          />
        </button>

        {/* Module name */}
        <div className="min-w-0 flex-1">
          {canManage ? (
            <EditableModuleName
              id={mod.id}
              name={mod.name}
              editing={isEditingName}
              onEditingChange={setIsEditingName}
              onSaved={onRefresh}
            />
          ) : (
            <h3 className="line-clamp-2 text-base font-bold sm:text-lg">{mod.name}</h3>
          )}
        </div>

        {/* Item count */}
        <div className="bg-primary/10 border-primary/20 flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 sm:px-3 sm:py-1.5">
          <span className="text-primary text-xs font-semibold sm:text-sm">{mod.items.length}</span>
        </div>

        {/* Teacher controls */}
        {canManage && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label="Mở menu thao tác chương"
                className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none sm:hidden"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onTogglePublish(mod.id)}>
                  {mod.isPublished ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {mod.isPublished ? 'Ẩn' : 'Hiển thị'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(mod.id, mod.name)}
                  variant="destructive"
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xoá
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="border-border/50 hidden items-center gap-0.5 border-l pl-1.5 sm:flex sm:gap-1 sm:pl-3">
              <button
                onClick={() => onTogglePublish(mod.id)}
                title={mod.isPublished ? 'Ẩn chương' : 'Xuất bản chương'}
                className={`rounded-lg p-2 transition-all ${mod.isPublished ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {mod.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onDelete(mod.id, mod.name)}
                title="Xoá chương"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-2 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Module Items */}
      <div
        className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0' : 'max-h-full'}`}
      >
        <div className="space-y-2 p-3">
          {localItems.length === 0 ? (
            <div className="border-border/40 bg-muted/10 rounded-lg border border-dashed px-4 py-8 text-center">
              <FolderOpen className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground/70 text-sm font-medium">
                Chưa có nội dung nào trong chương này.
              </p>
            </div>
          ) : (
            <DndContext
              id={`items-dnd-${mod.id}`}
              sensors={itemSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleItemDragEnd}
            >
              <SortableContext
                items={localItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {localItems.map((item) => {
                  const isQuiz = item.type === 'QUIZ';
                  const isPracticeTest = item.type === 'PRACTICE_TEST';
                  const isCodeExercise = item.type === 'CODE_EXERCISE';
                  const quizId = item.quiz?.id ?? item.quizId;
                  const practiceTestId = item.practiceTest?.id ?? item.practiceTestId;
                  const codeExId = item.codeExercise?.id ?? item.codeExerciseId;
                  const isDone =
                    (item.type === 'LESSON' && completedIds?.has(item.id)) ||
                    (item.type === 'ASSIGNMENT' &&
                      item.assignmentId &&
                      submittedAssignmentIds?.has(item.assignmentId)) ||
                    (isQuiz && quizId && submittedQuizIds?.has(quizId)) ||
                    (isPracticeTest &&
                      practiceTestId &&
                      submittedPracticeTestIds?.has(practiceTestId)) ||
                    (isCodeExercise && codeExId && submittedCodeExerciseIds?.has(codeExId));

                  return (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      courseSlug={courseSlug}
                      courseId={courseId}
                      canManage={canManage}
                      isDone={!!isDone}
                      onTogglePublish={onToggleItemPublish}
                      onDelete={onDeleteItem}
                      onRefresh={onRefresh}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* Add activity button */}
          {canManage && (
            <div className="pt-2">
              {openUrlFormId === mod.id ? (
                <AddExternalUrlForm
                  moduleId={mod.id}
                  onAdded={onRefresh}
                  onClose={() => onOpenUrlForm(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onAddActivity(mod.id)}
                  className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-semibold transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Thêm bài học / bài tập
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function ModuleList({
  courseSlug,
  courseId,
  modules,
  canManage,
  completedIds,
  submittedAssignmentIds,
  submittedQuizIds,
  submittedPracticeTestIds,
  submittedCodeExerciseIds,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localModules, setLocalModules] = useState<ModuleWithItems[]>(modules);
  const [showAddModule, setShowAddModule] = useState(false);
  const [modalModuleId, setModalModuleId] = useState<string | null>(null);
  const [openUrlFormId, setOpenUrlFormId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    setLocalModules(modules);
  }, [modules]);

  const moduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function refresh() {
    apiClient
      .get<ModuleWithItems[]>('/modules', { query: { courseId, publishedOnly: !canManage } })
      .then((fresh) => setLocalModules(fresh))
      .catch(() => {});
    // Also revalidate the Server Component so header counts (X chương,
    // Y bài học) update without a manual page reload.
    router.refresh();
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localModules.findIndex((m) => m.id === active.id);
    const newIdx = localModules.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(localModules, oldIdx, newIdx);
    setLocalModules(reordered);
    startTransition(async () => {
      try {
        await apiClient.patch('/modules/reorder', {
          courseId,
          orderedIds: reordered.map((m) => m.id),
        });
        refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi sắp xếp chương');
      }
    });
  }

  async function handleDeleteModule(id: string, name: string) {
    const ok = await openConfirm(
      `Xoá chương "${name}"? Tất cả bài học trong chương cũng sẽ bị xoá.`
    );
    if (!ok) return;
    setLocalModules((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      try {
        await apiClient.delete(`/modules/${id}`);
        toast.success('Đã xoá chương.');
        refresh();
      } catch (err) {
        refresh();
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá chương');
      }
    });
  }

  function handleTogglePublish(id: string) {
    setLocalModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPublished: !m.isPublished } : m))
    );
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/${id}/publish`);
        refresh();
      } catch (err) {
        refresh();
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái');
      }
    });
  }

  async function handleDeleteItem(id: string) {
    const ok = await openConfirm('Xoá mục này khỏi chương?');
    if (!ok) return;
    setLocalModules((prev) =>
      prev.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== id) }))
    );
    startTransition(async () => {
      try {
        await apiClient.delete(`/modules/items/${id}`);
        toast.success('Đã xoá mục.');
        refresh();
      } catch (err) {
        refresh();
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá mục');
      }
    });
  }

  function handleToggleItemPublish(id: string) {
    setLocalModules((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) => (i.id === id ? { ...i, isPublished: !i.isPublished } : i)),
      }))
    );
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/items/${id}/publish`);
        refresh();
      } catch (err) {
        refresh();
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật trạng thái');
      }
    });
  }

  return (
    <>
      {confirmDialog}

      {modalModuleId && (
        <AddActivityModal
          courseSlug={courseSlug}
          moduleId={modalModuleId}
          onClose={() => setModalModuleId(null)}
          onSelectUrl={() => {
            setOpenUrlFormId(modalModuleId);
            setModalModuleId(null);
          }}
        />
      )}

      <div className="space-y-6">
        {localModules.length > 0 && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setCollapsedIds(new Set())}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Mở rộng tất cả
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setCollapsedIds(new Set(localModules.map((m) => m.id)))}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Thu gọn tất cả
            </button>
          </div>
        )}

        {localModules.length === 0 &&
          (showAddModule ? (
            <AddModuleForm
              courseId={courseId}
              onAdded={() => {
                setShowAddModule(false);
                refresh();
              }}
              onCancel={() => setShowAddModule(false)}
            />
          ) : (
            <div className="border-border/60 bg-card/30 flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 backdrop-blur-sm">
              <div className="bg-muted/50 border-border/50 mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
                <FolderOpen className="text-muted-foreground/50 h-8 w-8" />
              </div>
              <p className="text-base font-semibold">Khoá học chưa có nội dung</p>
              <p className="text-muted-foreground mt-1 mb-6 text-sm">
                Hãy bắt đầu bằng việc thêm chương đầu tiên.
              </p>
              {canManage && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgb(253_8_93_/_40%)]"
                  onClick={() => setShowAddModule(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> Thêm chương đầu tiên
                </Button>
              )}
            </div>
          ))}

        <DndContext
          id="module-dnd"
          sensors={moduleSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleModuleDragEnd}
        >
          <SortableContext
            items={localModules.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {localModules.map((mod) => (
                <SortableModuleRow
                  key={mod.id}
                  mod={mod}
                  courseSlug={courseSlug}
                  courseId={courseId}
                  canManage={canManage}
                  completedIds={completedIds}
                  submittedAssignmentIds={submittedAssignmentIds}
                  submittedQuizIds={submittedQuizIds}
                  submittedPracticeTestIds={submittedPracticeTestIds}
                  submittedCodeExerciseIds={submittedCodeExerciseIds}
                  openUrlFormId={openUrlFormId}
                  isCollapsed={collapsedIds.has(mod.id)}
                  onToggleCollapse={() => toggleCollapse(mod.id)}
                  onTogglePublish={handleTogglePublish}
                  onDelete={handleDeleteModule}
                  onAddActivity={(id) => setModalModuleId(id)}
                  onDeleteItem={handleDeleteItem}
                  onToggleItemPublish={handleToggleItemPublish}
                  onOpenUrlForm={setOpenUrlFormId}
                  onRefresh={refresh}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {canManage && localModules.length > 0 && (
          <div className="pt-2">
            {showAddModule ? (
              <AddModuleForm
                courseId={courseId}
                onAdded={() => {
                  setShowAddModule(false);
                  refresh();
                }}
                onCancel={() => setShowAddModule(false)}
              />
            ) : (
              <Button
                variant="outline"
                className="border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 w-full border-dashed py-6 transition-colors"
                onClick={() => setShowAddModule(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Thêm chương mới
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
