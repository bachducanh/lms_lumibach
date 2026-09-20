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
  MessagesSquare,
  Share2,
  Library,
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
import { ModuleGroupModeButton } from './ModuleGroupModeButton';

type ModuleItem = ModuleWithItems['items'][number];

type Props = {
  courseSlug: string;
  courseId: string;
  modules: ModuleWithItems[];
  canManage: boolean;
  /** Cài đặt khoá học: chương đổ xuống sẵn hay chỉ hiện tên. */
  modulesExpandedByDefault?: boolean;
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
    icon: <BookOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />,
    iconBg: 'bg-teal-500/10',
    borderGlow: 'hover:border-teal-500/50',
  },
  {
    id: 'assignment',
    label: 'Bài tập',
    description: 'Giao bài tập, chấm điểm và nhận xét',
    icon: <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
    iconBg: 'bg-blue-500/10',
    borderGlow: 'hover:border-blue-500/50',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Kiểm tra nhanh bằng câu hỏi trắc nghiệm',
    icon: <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />,
    iconBg: 'bg-violet-500/10',
    borderGlow: 'hover:border-violet-500/50',
  },
  {
    id: 'practice_test',
    label: 'Đề luyện tập',
    description: 'Tải đề PDF, cấu hình phiếu trả lời và chấm tự động',
    icon: <FileQuestion className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />,
    iconBg: 'bg-cyan-500/10',
    borderGlow: 'hover:border-cyan-500/50',
  },
  {
    id: 'code_exercise',
    label: 'Bài tập code',
    description: 'Lập trình Python, JavaScript, C++ hoặc Web có chấm tự động',
    icon: <Code2 className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400" />,
    iconBg: 'bg-fuchsia-500/10',
    borderGlow: 'hover:border-fuchsia-500/50',
  },
  {
    id: 'scratch',
    label: 'Bài Scratch',
    description: 'Lập trình kéo thả Scratch ngay trong LMS, học sinh nộp project .sb3',
    icon: <Cat className="h-6 w-6 text-orange-600 dark:text-orange-400" />,
    iconBg: 'bg-orange-500/10',
    borderGlow: 'hover:border-orange-500/50',
  },
  {
    id: 'forum',
    label: 'Diễn đàn',
    description: 'Không gian thảo luận theo chủ đề cho chương này',
    icon: <MessagesSquare className="h-6 w-6 text-sky-600 dark:text-sky-400" />,
    iconBg: 'bg-sky-500/10',
    borderGlow: 'hover:border-sky-500/50',
  },
  {
    id: 'external_url',
    label: 'Link ngoài',
    description: 'Liên kết tới tài nguyên bên ngoài',
    icon: <ExternalLink className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    iconBg: 'bg-amber-500/10',
    borderGlow: 'hover:border-amber-500/50',
  },
];

// ── Add activity modal ────────────────────────────────────────

type ModalProps = {
  courseSlug: string;
  moduleId: string;
  onClose: () => void;
  onSelectInline: (kind: InlineFormKind) => void;
};

/** Hoạt động tạo được ngay tại chỗ, không cần sang trang riêng. */
type InlineFormKind = 'external_url' | 'forum';

function AddActivityModal({ courseSlug, moduleId, onClose, onSelectInline }: ModalProps) {
  function handleSelect(id: string) {
    if (id === 'external_url' || id === 'forum') {
      onSelectInline(id);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="border-border bg-card relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl">
        <div className="border-border bg-muted/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <Sparkles className="text-primary h-4 w-4 shrink-0" />
              Thêm hoạt động hoặc tài nguyên
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Chọn loại nội dung bạn muốn thêm vào chương này
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
          {ACTIVITY_DEFS.map((act) => {
            const href = navHrefs[act.id];
            const inner = (
              <div
                className={`border-border bg-card flex w-full cursor-pointer items-start gap-4 rounded-xl border p-4 shadow-sm transition-shadow duration-200 hover:shadow-md ${act.borderGlow} group`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${act.iconBg}`}
                >
                  {act.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="group-hover:text-foreground text-base font-semibold transition-colors">
                    {act.label}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
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
      className="border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-sm sm:p-4"
    >
      <FolderOpen className="text-muted-foreground h-5 w-5 shrink-0" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên chương mới (VD: Chương 1: Giới thiệu)..."
        required
        autoFocus
        className="placeholder:text-muted-foreground/60 h-10 min-w-0 flex-1 basis-40 border-none bg-transparent px-2 text-sm font-semibold focus:ring-0 focus:outline-none"
      />
      <div className="ml-auto flex shrink-0 gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Hủy
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
      <div className="mb-1 flex items-center justify-between">
        <span className="text-primary flex items-center gap-1.5 text-sm font-semibold">
          <ExternalLink className="h-3.5 w-3.5" />
          Thêm link ngoài
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Tài liệu tham khảo)"
        required
        className="border-border bg-card focus:ring-primary h-10 w-full rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (https://...)"
        type="url"
        required
        className="border-border bg-card focus:ring-primary h-10 w-full rounded-lg border px-3 font-mono text-sm focus:ring-1 focus:outline-none"
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

function AddForumForm({
  courseId,
  moduleId,
  onAdded,
  onClose,
}: {
  courseId: string;
  moduleId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await apiClient.post('/forum/forums', {
          courseId,
          moduleId,
          title,
          description: description.trim() || undefined,
        });
        toast.success('Đã tạo diễn đàn.');
        setTitle('');
        setDescription('');
        onAdded();
        onClose();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi tạo diễn đàn');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-primary/30 bg-primary/5 relative mt-2 space-y-3 overflow-hidden rounded-xl border p-4"
    >
      <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />
      <div className="mb-1 flex items-center justify-between">
        <span className="text-primary flex items-center gap-1.5 text-sm font-semibold">
          <MessagesSquare className="h-3.5 w-3.5" />
          Thêm diễn đàn
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tên diễn đàn (VD: Hỏi đáp Bài 1)"
        required
        minLength={3}
        className="border-border bg-card focus:ring-primary h-10 w-full rounded-lg border px-3 text-sm focus:ring-1 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Mô tả ngắn (tuỳ chọn) — nội dung nào được thảo luận ở đây?"
        rows={2}
        className="border-border bg-card focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
      />
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {pending ? 'Đang tạo...' : 'Tạo diễn đàn'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

/**
 * Bật / tắt đưa hoạt động vào ngân hàng nội dung của danh mục khoá học.
 *
 * Cập nhật lạc quan rồi mới gọi API — soạn xong một chương thường bấm chia sẻ
 * cả loạt, chờ round-trip từng cái thì rất khựng.
 */
function ShareItemToggle({ itemId, initialShared }: { itemId: string; initialShared: boolean }) {
  const [shared, setShared] = useState(initialShared);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !shared;
    setShared(next);
    startTransition(async () => {
      try {
        await apiClient.patch(`/modules/items/${itemId}/share`, { shared: next });
        toast.success(next ? 'Đã đưa vào ngân hàng nội dung.' : 'Đã gỡ khỏi ngân hàng nội dung.');
      } catch (err) {
        setShared(!next);
        toast.error(err instanceof ApiError ? err.message : 'Lỗi cập nhật chia sẻ');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        shared
          ? 'Đang chia sẻ vào ngân hàng nội dung — bấm để gỡ'
          : 'Chia sẻ hoạt động này cho khoá khác cùng danh mục'
      }
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        shared
          ? 'text-primary hover:bg-primary/10'
          : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted'
      }`}
    >
      <Share2 className="h-4 w-4" />
    </button>
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
  const isForum = item.type === 'FORUM';
  const forumId = item.forum?.id ?? item.forumId;
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
    { border: string; bg: string; icon: string; text: string; bgRgba: string }
  > = {
    lesson: {
      border: 'border-l-teal-500',
      bg: 'bg-teal-500/15',
      icon: 'text-teal-600 dark:text-teal-400',
      text: 'Bài học',
      bgRgba: 'rgba(20, 184, 166, 0.15)',
    },
    assignment: {
      border: 'border-l-blue-500',
      bg: 'bg-blue-500/15',
      icon: 'text-blue-600 dark:text-blue-400',
      text: 'Bài tập',
      bgRgba: 'rgba(59, 130, 246, 0.15)',
    },
    quiz: {
      border: 'border-l-violet-500',
      bg: 'bg-violet-500/15',
      icon: 'text-violet-600 dark:text-violet-400',
      text: 'Quiz',
      bgRgba: 'rgba(139, 92, 246, 0.15)',
    },
    practice: {
      border: 'border-l-cyan-500',
      bg: 'bg-cyan-500/15',
      icon: 'text-cyan-600 dark:text-cyan-400',
      text: 'Đề luyện tập',
      bgRgba: 'rgba(6, 182, 212, 0.15)',
    },
    code: {
      border: 'border-l-fuchsia-500',
      bg: 'bg-fuchsia-500/15',
      icon: 'text-fuchsia-600 dark:text-fuchsia-400',
      text: 'Bài tập code',
      bgRgba: 'rgba(217, 70, 239, 0.15)',
    },
    scratch: {
      border: 'border-l-orange-500',
      bg: 'bg-orange-500/15',
      icon: 'text-orange-600 dark:text-orange-400',
      text: 'Bài Scratch',
      bgRgba: 'rgba(251, 146, 60, 0.15)',
    },
    forum: {
      border: 'border-l-sky-500',
      bg: 'bg-sky-500/15',
      icon: 'text-sky-600 dark:text-sky-400',
      text: 'Diễn đàn',
      bgRgba: 'rgba(14, 165, 233, 0.15)',
    },
    external: {
      border: 'border-l-amber-500',
      bg: 'bg-amber-500/15',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'Link ngoài',
      bgRgba: 'rgba(245, 158, 11, 0.15)',
    },
  };

  let typeKey: keyof typeof typeColors = 'lesson';
  if (isExternalUrl) typeKey = 'external';
  else if (isForum) typeKey = 'forum';
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
            : // Diễn đàn không có trang sửa riêng — đổi tên qua nút Sửa trong chương.
              null;

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
          }),
      }}
      className={`border-border relative flex items-center gap-2 border border-l-4 ${colors.border} bg-card group/item overflow-hidden rounded-lg px-2 py-2.5 transition-colors duration-200 sm:gap-3 sm:px-3 sm:py-3 ${isDragging ? 'ring-primary/30 z-50 scale-95 opacity-40 shadow-xl ring-2' : 'hover:shadow-sm'}`}
    >
      {/* Drag handle */}
      {canManage && (
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/60 hover:text-muted-foreground flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center transition-colors active:cursor-grabbing sm:w-6"
          tabIndex={-1}
          aria-label="Kéo để sắp xếp"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Icon with colored background */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 ${colors.bg}`}
      >
        {isExternalUrl ? (
          <Link2 className={`h-5 w-5 ${colors.icon}`} />
        ) : isForum ? (
          <MessagesSquare className={`h-5 w-5 ${colors.icon}`} />
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
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </a>
        ) : isForum && forumId ? (
          <Link href={`/courses/${courseSlug}/forum?forumId=${forumId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </Link>
        ) : isAssignment && item.assignmentId ? (
          <Link href={`/courses/${courseSlug}/assignments/${item.assignmentId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </Link>
        ) : isQuiz && quizId ? (
          <Link href={`/courses/${courseSlug}/quizzes/${quizId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </Link>
        ) : isPracticeTest && practiceTestId ? (
          <Link href={`/courses/${courseSlug}/practice-tests/${practiceTestId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            <p className="text-muted-foreground text-xs">{colors.text}</p>
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
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </Link>
        ) : item.lessonId ? (
          <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}`} className="block">
            <p className="group-hover/item:text-primary line-clamp-2 text-sm font-semibold transition-colors">
              {item.title}
            </p>
            {item.lesson?.estimatedMinutes && (
              <p className="text-muted-foreground text-xs">⏱ {item.lesson.estimatedMinutes} phút</p>
            )}
          </Link>
        ) : (
          <div className="block">
            <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
            <p className="text-muted-foreground text-xs">{colors.text}</p>
          </div>
        )}
      </div>

      {/* Right side - Status badges and actions */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        {canManage && (
          <ShareItemToggle itemId={item.id} initialShared={item.sharedToCategory ?? false} />
        )}
        {isDone && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-600/30 bg-emerald-500/15 dark:border-emerald-500/40 dark:bg-emerald-500/20"
            title="Đã hoàn thành"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
        {!item.isPublished && (
          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
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
                className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors outline-none"
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
                  onClick={() => {
                    // Defer mở dialog sang tick sau để tránh đụng focus
                    // restore khi DropdownMenu đóng (Base UI v1.4).
                    setTimeout(() => setGroupDialogOpen(true), 0);
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
          </>
        )}
      </div>

      {/* Controlled dialog "Cài đặt nhóm" — luôn mount để open prop có thể chuyển false→true */}
      {canManage && (
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
      )}
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
  inlineForm: InlineFormKind | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePublish: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onAddActivity: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onToggleItemPublish: (id: string) => void;
  onCloseInlineForm: () => void;
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
  inlineForm,
  isCollapsed,
  onToggleCollapse,
  onTogglePublish,
  onDelete,
  onAddActivity,
  onDeleteItem,
  onToggleItemPublish,
  onCloseInlineForm,
  onRefresh,
}: ModuleRowProps) {
  const [, startItemTransition] = useTransition();
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

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
  };

  return (
    <div
      ref={setNodeRef}
      style={outerStyle}
      className={`border-border bg-card group/module overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 ${isDragging ? 'ring-primary/20 opacity-40 shadow-xl ring-2' : 'hover:shadow-md'}`}
    >
      {/* Module Header */}
      <div className="bg-muted/40 border-border flex items-center gap-1 border-b px-2 py-3 sm:gap-3 sm:px-4 sm:py-4">
        {/* Drag handle */}
        {canManage && (
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground/60 hover:text-muted-foreground flex h-8 w-5 cursor-grab touch-none items-center justify-center transition-colors active:cursor-grabbing"
            tabIndex={-1}
            aria-label="Kéo để sắp xếp chương"
          >
            <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
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
        <div className="bg-primary/10 border-primary/20 flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1">
          <span className="text-primary text-xs font-semibold sm:text-sm">{mod.items.length}</span>
        </div>

        {/* Teacher controls */}
        {canManage && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label="Mở menu thao tác chương"
                className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors outline-none"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // Defer mở dialog sang tick sau để tránh đụng focus
                    // restore khi DropdownMenu đóng (Base UI v1.4).
                    setTimeout(() => setGroupDialogOpen(true), 0);
                  }}
                  disabled={mod.items.length === 0}
                  title={mod.items.length === 0 ? 'Chương chưa có hoạt động' : undefined}
                >
                  <UsersRound className="mr-2 h-4 w-4" />
                  Cài đặt nhóm
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
          </>
        )}
      </div>

      {/* Controlled dialog "Cài đặt nhóm cho cả chương" */}
      {canManage && (
        <ModuleGroupModeButton
          courseId={courseId}
          moduleId={mod.id}
          itemCount={mod.items.length}
          open={groupDialogOpen}
          onOpenChange={setGroupDialogOpen}
          onChanged={onRefresh}
        />
      )}

      {/* Module Items */}
      <div
        className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0' : 'max-h-full'}`}
      >
        <div className="space-y-2 p-3">
          {localItems.length === 0 ? (
            <div className="border-border bg-muted/30 rounded-lg border border-dashed px-4 py-8 text-center">
              <FolderOpen className="text-muted-foreground/60 mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm font-medium">
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
              {inlineForm === 'external_url' ? (
                <AddExternalUrlForm
                  moduleId={mod.id}
                  onAdded={onRefresh}
                  onClose={onCloseInlineForm}
                />
              ) : inlineForm === 'forum' ? (
                <AddForumForm
                  courseId={courseId}
                  moduleId={mod.id}
                  onAdded={onRefresh}
                  onClose={onCloseInlineForm}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onAddActivity(mod.id)}
                  className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-semibold transition-colors"
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
  modulesExpandedByDefault = true,
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
  // Hoạt động tạo tại chỗ (link ngoài / diễn đàn): mở form ngay dưới chương nào.
  const [inlineForm, setInlineForm] = useState<{ moduleId: string; kind: InlineFormKind } | null>(
    null
  );
  // Trạng thái ban đầu theo cài đặt khoá học; sau đó người xem tự bấm đổi.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    modulesExpandedByDefault ? new Set() : new Set(modules.map((m) => m.id))
  );
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
      `Xoá chương "${name}"? Mọi hoạt động trong chương — bài giảng, bài tập, ` +
        `quiz, bài code, diễn đàn — cũng bị xoá và biến mất khỏi các tab tương ứng.`
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
    const ok = await openConfirm(
      'Xoá mục này? Hoạt động tương ứng cũng bị xoá khỏi tab riêng của nó ' +
        '(bài tập / quiz / bài code / diễn đàn), không chỉ gỡ khỏi chương.'
    );
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
          onSelectInline={(kind) => {
            setInlineForm({ moduleId: modalModuleId, kind });
            setModalModuleId(null);
          }}
        />
      )}

      <div className="space-y-6">
        {canManage && (
          <div className="flex justify-end">
            <Link
              href={`/courses/${courseSlug}/modules/bank`}
              className="text-muted-foreground hover:text-primary inline-flex min-h-9 items-center gap-1.5 text-sm transition-colors"
            >
              <Library className="h-4 w-4" />
              Ngân hàng nội dung
            </Link>
          </div>
        )}

        {localModules.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <button
              onClick={() => setCollapsedIds(new Set())}
              className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 text-sm transition-colors"
            >
              <ChevronsUpDown className="h-4 w-4" />
              Mở rộng tất cả
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setCollapsedIds(new Set(localModules.map((m) => m.id)))}
              className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 text-sm transition-colors"
            >
              <ChevronsUpDown className="h-4 w-4" />
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
            <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-16 text-center">
              <div className="bg-primary/10 text-primary mb-4 flex h-14 w-14 items-center justify-center rounded-lg">
                <FolderOpen className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold">Khoá học chưa có nội dung</p>
              <p className="text-muted-foreground mt-1 mb-6 text-sm">
                Hãy bắt đầu bằng việc thêm chương đầu tiên.
              </p>
              {canManage && (
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                  inlineForm={inlineForm?.moduleId === mod.id ? inlineForm.kind : null}
                  isCollapsed={collapsedIds.has(mod.id)}
                  onToggleCollapse={() => toggleCollapse(mod.id)}
                  onTogglePublish={handleTogglePublish}
                  onDelete={handleDeleteModule}
                  onAddActivity={(id) => setModalModuleId(id)}
                  onDeleteItem={handleDeleteItem}
                  onToggleItemPublish={handleToggleItemPublish}
                  onCloseInlineForm={() => setInlineForm(null)}
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
                className="border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 h-12 w-full border-dashed transition-colors"
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
