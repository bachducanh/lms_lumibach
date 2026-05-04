'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  GripVertical, Plus, Pencil, Trash2,
  Eye, EyeOff, BookOpen, CheckCircle2, Link2, X,
  ClipboardList, ExternalLink, Brain, Sparkles, FolderOpen, Code2,
  ChevronDown, ChevronsUpDown,
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
import {
  createModuleAction, updateModuleAction, deleteModuleAction,
  toggleModulePublishAction, reorderModulesAction, reorderModuleItemsAction,
  addModuleItemAction, deleteModuleItemAction, toggleModuleItemPublishAction,
  type ModuleWithItems,
} from '@/actions/modules';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type ModuleItem = ModuleWithItems['items'][number];

type Props = {
  courseSlug: string;
  courseId:   string;
  modules:    ModuleWithItems[];
  canManage:  boolean;
  completedIds?: Set<string>;
  submittedAssignmentIds?: Set<string>;
  submittedQuizIds?: Set<string>;
  submittedCodeExerciseIds?: Set<string>;
};

// ── Activity types shown in the picker modal ──────────────────

type ActivityDef = {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  iconBg:      string;
  borderGlow:  string;
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
    id: 'code_exercise',
    label: 'Bài tập code',
    description: 'Lập trình Python, JavaScript, C++ hoặc Web có chấm tự động',
    icon: <Code2 className="h-7 w-7 text-fuchsia-400" />,
    iconBg: 'bg-fuchsia-500/10',
    borderGlow: 'hover:border-fuchsia-500/40 hover:shadow-[0_0_15px_rgba(217,70,239,0.2)]',
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
  courseSlug:  string;
  moduleId:    string;
  onClose:     () => void;
  onSelectUrl: () => void;
};

function AddActivityModal({ courseSlug, moduleId, onClose, onSelectUrl }: ModalProps) {
  function handleSelect(id: string) {
    if (id === 'external_url') { onSelectUrl(); onClose(); }
  }

  const navHrefs: Record<string, string> = {
    lesson:        `/courses/${courseSlug}/lessons/new?moduleId=${moduleId}`,
    assignment:    `/courses/${courseSlug}/assignments/new?moduleId=${moduleId}`,
    quiz:          `/courses/${courseSlug}/quizzes/new?moduleId=${moduleId}`,
    code_exercise: `/courses/${courseSlug}/exercises/new?moduleId=${moduleId}`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border/50 bg-card/90 shadow-2xl overflow-hidden"
           style={{ boxShadow: '0 24px 64px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(1 0 0 / 10%)' }}>

        <div className="absolute top-0 left-0 right-0 h-[2px]"
             style={{ background: 'linear-gradient(90deg, transparent, rgb(253 8 93 / 80%), oklch(0.80 0.13 210 / 0.6), transparent)' }} />

        <div className="flex items-center justify-between border-b border-border/50 px-6 py-5 bg-muted/20">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Thêm hoạt động hoặc tài nguyên
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Chọn loại nội dung bạn muốn thêm vào chương này</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary transition-colors rounded-md p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          {ACTIVITY_DEFS.map((act) => {
            const href = navHrefs[act.id];
            const inner = (
              <div className={`w-full flex items-start gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 cursor-pointer ${act.borderGlow} hover:-translate-y-0.5 group`}>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${act.iconBg}`}>
                  {act.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold group-hover:text-foreground transition-colors">{act.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{act.description}</p>
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
              <button key={act.id} type="button" onClick={() => handleSelect(act.id)} className="flex text-left">
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

function EditableModuleName({ id, name, onSaved }: { id: string; name: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateModuleAction(id, { name: value });
      if (res.success) { toast.success(res.message); setEditing(false); onSaved(); }
      else { toast.error(res.error); setValue(name); setEditing(false); }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(name); setEditing(false); } }}
        disabled={pending}
        className="flex-1 bg-transparent border-b border-primary outline-none font-bold text-lg"
      />
    );
  }

  return (
    <h3 className="flex-1 text-base sm:text-lg font-bold cursor-pointer hover:text-primary transition-colors line-clamp-2" onClick={() => setEditing(true)}>
      {name}
    </h3>
  );
}

// ── Add module form ───────────────────────────────────────────

function AddModuleForm({ courseId, onAdded, onCancel }: { courseId: string; onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createModuleAction(courseId, { name });
      if (res.success) { toast.success(res.message); setName(''); onAdded(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 rounded-xl border border-border bg-card p-4 items-center">
      <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên chương mới (VD: Chương 1: Giới thiệu)..."
        required
        autoFocus
        className="flex-1 bg-transparent border-none px-2 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-semibold"
      />
      <div className="flex gap-2 shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Hủy</Button>
        <Button type="submit" size="sm" disabled={pending} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgb(253_8_93_/_40%)]">
          Lưu chương
        </Button>
      </div>
    </form>
  );
}

// ── Add external URL form ─────────────────────────────────────

function AddExternalUrlForm({ moduleId, onAdded, onClose }: { moduleId: string; onAdded: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addModuleItemAction(moduleId, { title, type: 'EXTERNAL_URL', externalUrl: url });
      if (res.success) { toast.success(res.message); setTitle(''); setUrl(''); onAdded(); onClose(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Thêm link ngoài
        </span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Tài liệu tham khảo)"
        required
        className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (https://...)"
        type="url"
        required
        className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
      />
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={pending} className="bg-primary hover:bg-primary/90 text-primary-foreground">Lưu link</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Huỷ</Button>
      </div>
    </form>
  );
}

// ── Sortable item row ─────────────────────────────────────────

type ItemRowProps = {
  item:        ModuleItem;
  courseSlug:  string;
  canManage:   boolean;
  isDone:      boolean;
  onTogglePublish: (id: string) => void;
  onDelete:        (id: string) => void;
};

function SortableItemRow({ item, courseSlug, canManage, isDone, onTogglePublish, onDelete }: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canManage,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isExternalUrl  = item.type === 'EXTERNAL_URL';
  const isAssignment   = item.type === 'ASSIGNMENT';
  const isQuiz         = item.type === 'QUIZ';
  const isCodeExercise = item.type === 'CODE_EXERCISE';
  const quizId         = (item as any).quiz?.id ?? (item as any).quizId;
  const codeExId       = (item as any).codeExercise?.id ?? (item as any).codeExerciseId;
  const codeExLang     = (item as any).codeExercise?.language as string | undefined;
  const LANG_ICON: Record<string, string> = {
    PYTHON3: '/question_icon/python_icon.png',
    CPP17:   '/question_icon/cplusplus_icon.png',
    WEB:     '/question_icon/web_icon_v2.png',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors group/item overflow-hidden
        ${isDragging ? 'opacity-40 ring-2 ring-primary/30 shadow-xl bg-card z-50' : ''}`}
    >
      {/* Left glow line */}
      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary opacity-0 group-hover/item:opacity-100 transition-opacity"
           style={{ boxShadow: '0 0 10px rgb(253 8 93 / 60%)' }} />

      {/* Drag handle */}
      {canManage && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 flex items-center justify-center h-7 w-5 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing touch-none relative z-10"
          tabIndex={-1}
          aria-label="Kéo để sắp xếp"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card border border-border/50 shadow-sm">
        {isExternalUrl  ? <Link2         className="h-4 w-4 text-amber-500"  />
          : isAssignment  ? <ClipboardList className="h-4 w-4 text-blue-500"   />
          : isQuiz        ? <Brain         className="h-4 w-4 text-violet-500" />
          : isCodeExercise && codeExLang && LANG_ICON[codeExLang]
            ? <Image src={LANG_ICON[codeExLang]} alt={codeExLang} width={22} height={22} className="object-contain" />
          : isCodeExercise ? <Code2        className="h-4 w-4 text-fuchsia-500" />
          : <BookOpen className="h-4 w-4 text-teal-500" />}
      </div>

      {/* Title link */}
      <div className="flex-1 min-w-0">
        {isExternalUrl && item.externalUrl ? (
          <a href={item.externalUrl} target="_blank" rel="noopener noreferrer"
             className="block truncate text-sm font-semibold group-hover/item:text-primary transition-colors after:absolute after:inset-0">
            {item.title}
          </a>
        ) : isAssignment && item.assignmentId ? (
          <Link href={`/courses/${courseSlug}/assignments/${item.assignmentId}`}
                className="block truncate text-sm font-semibold group-hover/item:text-primary transition-colors after:absolute after:inset-0">
            {item.title}
          </Link>
        ) : isQuiz && quizId ? (
          <Link href={`/courses/${courseSlug}/quizzes/${quizId}`}
                className="block truncate text-sm font-semibold group-hover/item:text-primary transition-colors after:absolute after:inset-0">
            {item.title}
          </Link>
        ) : isCodeExercise && codeExId ? (
          <Link href={`/courses/${courseSlug}/exercises/${codeExId}`}
                className="block truncate text-sm font-semibold group-hover/item:text-primary transition-colors after:absolute after:inset-0">
            {item.title}
          </Link>
        ) : item.lessonId ? (
          <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}`}
                className="block truncate text-sm font-semibold group-hover/item:text-primary transition-colors after:absolute after:inset-0">
            {item.title}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold">{item.title}</span>
        )}
        {item.lesson?.estimatedMinutes && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.lesson.estimatedMinutes} phút</p>
        )}
      </div>

      {/* Status badges */}
      {isDone && (
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0" title="Đã hoàn thành">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        </div>
      )}
      {!item.isPublished && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50">Ẩn</Badge>
      )}

      {/* Teacher actions toolbar */}
      {canManage && (
        <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border/50 absolute right-4 z-10">
          {item.lessonId && (
            <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}/edit`}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
          {item.assignmentId && (
            <Link href={`/courses/${courseSlug}/assignments/${item.assignmentId}/edit`}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
          {isQuiz && quizId && (
            <Link href={`/courses/${courseSlug}/quizzes/${quizId}/edit`}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
          {isCodeExercise && codeExId && (
            <Link href={`/courses/${courseSlug}/exercises/${codeExId}/edit`}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
          <div className="w-px h-4 bg-border mx-0.5" />
          <button onClick={() => onTogglePublish(item.id)}
                  className={`p-1.5 rounded-md transition-colors ${item.isPublished ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            {item.isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onDelete(item.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sortable module row ───────────────────────────────────────

type ModuleRowProps = {
  mod:          ModuleWithItems;
  courseSlug:   string;
  canManage:    boolean;
  completedIds?: Set<string>;
  submittedAssignmentIds?: Set<string>;
  submittedQuizIds?: Set<string>;
  submittedCodeExerciseIds?: Set<string>;
  openUrlFormId:       string | null;
  isCollapsed:         boolean;
  onToggleCollapse:    () => void;
  onTogglePublish:     (id: string) => void;
  onDelete:            (id: string, name: string) => void;
  onAddActivity:       (id: string) => void;
  onDeleteItem:        (id: string) => void;
  onToggleItemPublish: (id: string) => void;
  onOpenUrlForm:       (id: string | null) => void;
  onRefresh:           () => void;
};

function SortableModuleRow({
  mod, courseSlug, canManage,
  completedIds, submittedAssignmentIds, submittedQuizIds, submittedCodeExerciseIds,
  openUrlFormId, isCollapsed, onToggleCollapse, onTogglePublish, onDelete, onAddActivity,
  onDeleteItem, onToggleItemPublish, onOpenUrlForm, onRefresh,
}: ModuleRowProps) {
  const router = useRouter();
  const [, startItemTransition] = useTransition();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
    disabled: !canManage,
  });

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [localItems, setLocalItems] = useState<ModuleItem[]>(mod.items);
  useEffect(() => { setLocalItems(mod.items); }, [mod.items]);

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localItems.findIndex((i) => i.id === active.id);
    const newIdx = localItems.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(localItems, oldIdx, newIdx);
    setLocalItems(reordered);
    startItemTransition(async () => {
      const res = await reorderModuleItemsAction(mod.id, reordered.map((i) => i.id));
      if (!res.success) toast.error(res.error);
      else router.refresh();
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
      className={`rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-border/80 group/module
        ${isDragging ? 'opacity-40 ring-2 ring-primary/20' : ''}`}
    >
      {/* Module Header */}
      <div className="px-4 py-3 sm:px-5 sm:py-4 bg-muted/20 border-b border-primary/20 flex items-center gap-2 sm:gap-3">
        {canManage && (
          <button
            {...attributes}
            {...listeners}
            className="flex items-center justify-center h-7 w-4 sm:w-5 shrink-0 text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing touch-none"
            tabIndex={-1}
            aria-label="Kéo để sắp xếp chương"
          >
            <GripVertical className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        <button
          onClick={onToggleCollapse}
          className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted/60 transition-colors"
          title={isCollapsed ? 'Mở rộng chương' : 'Thu gọn chương'}
        >
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </button>

        <div className="flex-1 min-w-0">
          {canManage ? (
            <EditableModuleName id={mod.id} name={mod.name} onSaved={onRefresh} />
          ) : (
            <h3 className="text-base sm:text-lg font-bold line-clamp-2">{mod.name}</h3>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px] sm:text-xs font-mono bg-background border-border/50">
            {mod.items.length} bài
          </Badge>
          {canManage && (
            <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
              <button
                onClick={() => onTogglePublish(mod.id)}
                title={mod.isPublished ? 'Ẩn chương' : 'Xuất bản chương'}
                className={`p-1.5 rounded-md transition-colors ${mod.isPublished ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {mod.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => onDelete(mod.id, mod.name)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Module Items */}
      <div className={`p-2 space-y-1 ${isCollapsed ? 'hidden' : ''}`}>
        {localItems.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground italic">Chưa có nội dung nào trong chương này.</p>
          </div>
        ) : (
          <DndContext
            id={`items-dnd-${mod.id}`}
            sensors={itemSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {localItems.map((item) => {
                const isQuiz         = item.type === 'QUIZ';
                const isCodeExercise = item.type === 'CODE_EXERCISE';
                const quizId   = (item as any).quiz?.id   ?? (item as any).quizId;
                const codeExId = (item as any).codeExercise?.id ?? (item as any).codeExerciseId;
                const isDone =
                  (item.type === 'LESSON'    && completedIds?.has(item.id)) ||
                  (item.type === 'ASSIGNMENT' && item.assignmentId && submittedAssignmentIds?.has(item.assignmentId)) ||
                  (isQuiz                    && quizId   && submittedQuizIds?.has(quizId)) ||
                  (isCodeExercise            && codeExId && submittedCodeExerciseIds?.has(codeExId));

                return (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    courseSlug={courseSlug}
                    canManage={canManage}
                    isDone={!!isDone}
                    onTogglePublish={onToggleItemPublish}
                    onDelete={onDeleteItem}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}

        {/* Add activity button */}
        {canManage && (
          <div className="px-2 pb-2 pt-1">
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
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/30 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 mt-2"
              >
                <Plus className="h-4 w-4" />
                Thêm bài học / bài tập
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function ModuleList({ courseSlug, courseId, modules, canManage, completedIds, submittedAssignmentIds, submittedQuizIds, submittedCodeExerciseIds }: Props) {
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => { setLocalModules(modules); }, [modules]);

  const moduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function refresh() { startTransition(() => router.refresh()); }

  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localModules.findIndex((m) => m.id === active.id);
    const newIdx = localModules.findIndex((m) => m.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(localModules, oldIdx, newIdx);
    setLocalModules(reordered);
    startTransition(async () => {
      const res = await reorderModulesAction(courseId, reordered.map((m) => m.id));
      if (!res.success) toast.error(res.error);
      else router.refresh();
    });
  }

  async function handleDeleteModule(id: string, name: string) {
    const ok = await openConfirm(`Xoá chương "${name}"? Tất cả bài học trong chương cũng sẽ bị xoá.`);
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteModuleAction(id);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  function handleTogglePublish(id: string) {
    startTransition(async () => {
      const res = await toggleModulePublishAction(id);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  async function handleDeleteItem(id: string) {
    const ok = await openConfirm('Xoá mục này khỏi chương?');
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteModuleItemAction(id);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  function handleToggleItemPublish(id: string) {
    startTransition(async () => {
      const res = await toggleModuleItemPublishAction(id);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
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
          onSelectUrl={() => { setOpenUrlFormId(modalModuleId); setModalModuleId(null); }}
        />
      )}

      <div className="space-y-6">
        {localModules.length > 0 && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setCollapsedIds(new Set())}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Mở rộng tất cả
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setCollapsedIds(new Set(localModules.map((m) => m.id)))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Thu gọn tất cả
            </button>
          </div>
        )}

        {localModules.length === 0 && !showAddModule && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 py-20 backdrop-blur-sm">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 border border-border/50">
              <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-base font-semibold">Khoá học chưa có nội dung</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Hãy bắt đầu bằng việc thêm chương đầu tiên.</p>
            {canManage && (
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgb(253_8_93_/_40%)]" onClick={() => setShowAddModule(true)}>
                <Plus className="h-4 w-4 mr-2" /> Thêm chương đầu tiên
              </Button>
            )}
          </div>
        )}

        <DndContext
          id="module-dnd"
          sensors={moduleSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleModuleDragEnd}
        >
          <SortableContext items={localModules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {localModules.map((mod) => (
                <SortableModuleRow
                  key={mod.id}
                  mod={mod}
                  courseSlug={courseSlug}
                  canManage={canManage}
                  completedIds={completedIds}
                  submittedAssignmentIds={submittedAssignmentIds}
                  submittedQuizIds={submittedQuizIds}
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

        {canManage && (
          <div className="pt-2">
            {showAddModule ? (
              <AddModuleForm courseId={courseId} onAdded={() => { setShowAddModule(false); refresh(); }} onCancel={() => setShowAddModule(false)} />
            ) : (
              <Button variant="outline" className="w-full border-dashed border-border/60 py-6 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors" onClick={() => setShowAddModule(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm chương mới
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
