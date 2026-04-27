'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ChevronUp, ChevronDown, Plus, Pencil, Trash2,
  Eye, EyeOff, BookOpen, CheckCircle2, Circle, Link2, X,
} from 'lucide-react';
import {
  createModuleAction, updateModuleAction, deleteModuleAction,
  toggleModulePublishAction, reorderModulesAction,
  addModuleItemAction, deleteModuleItemAction, toggleModuleItemPublishAction,
  type ModuleWithItems,
} from '@/actions/modules';

type Props = {
  courseSlug: string;
  courseId: string;
  modules: ModuleWithItems[];
  canManage: boolean;
  completedIds?: Set<string>;
};

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
        className="flex-1 bg-transparent border-b border-primary outline-none text-sm font-semibold"
      />
    );
  }

  return (
    <span className="flex-1 text-sm font-semibold cursor-pointer hover:text-primary" onClick={() => setEditing(true)}>
      {name}
    </span>
  );
}

// ── Add module form ───────────────────────────────────────────

function AddModuleForm({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createModuleAction(courseId, { name });
      if (res.success) { toast.success(res.message); setName(''); onAdded(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên chương mới (VD: Chương 1: Giới thiệu)..."
        required
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={pending}>Thêm</Button>
    </form>
  );
}

// ── Add external URL form ────────────────────────────────────

function AddExternalUrlForm({ moduleId, onAdded, onClose }: { moduleId: string; onAdded: () => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addModuleItemAction(moduleId, { title, type: 'EXTERNAL_URL', externalUrl: url });
      if (res.success) { toast.success(res.message); setTitle(''); setUrl(''); onAdded(); onClose(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">Thêm link ngoài</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Tài liệu tham khảo)"
        required
        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL (https://...)"
        type="url"
        required
        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>Thêm</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Huỷ</Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────

export function ModuleList({ courseSlug, courseId, modules, canManage, completedIds }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAddModule, setShowAddModule] = useState(false);
  const [openUrlFormId, setOpenUrlFormId] = useState<string | null>(null);

  function refresh() { startTransition(() => router.refresh()); }

  function handleDeleteModule(id: string, name: string) {
    if (!confirm(`Xoá chương "${name}"? Tất cả bài học trong chương cũng sẽ bị xoá.`)) return;
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

  function handleDeleteItem(id: string) {
    if (!confirm('Xoá bài học này khỏi chương?')) return;
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

  function handleMoveModule(index: number, direction: 'up' | 'down') {
    const newOrder = [...modules];
    const target = direction === 'up' ? index - 1 : index + 1;
    const tmp = newOrder[index];
    const neighbor = newOrder[target];
    if (!tmp || !neighbor) return;
    newOrder[index] = neighbor;
    newOrder[target] = tmp;
    startTransition(async () => {
      await reorderModulesAction(courseId, newOrder.map((m) => m.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {modules.length === 0 && !showAddModule && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Khoá học chưa có chương nào.</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddModule(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Thêm chương đầu tiên
            </Button>
          )}
        </div>
      )}

      {modules.map((mod, idx) => (
        <Card key={mod.id}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              {/* Reorder buttons */}
              {canManage && (
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => handleMoveModule(idx, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleMoveModule(idx, 'down')} disabled={idx === modules.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {canManage ? (
                <EditableModuleName id={mod.id} name={mod.name} onSaved={refresh} />
              ) : (
                <span className="flex-1 text-sm font-semibold">{mod.name}</span>
              )}

              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {mod.items.length} bài
                </Badge>
                {canManage && (
                  <>
                    <button onClick={() => handleTogglePublish(mod.id)} title={mod.isPublished ? 'Ẩn chương' : 'Xuất bản chương'} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                      {mod.isPublished ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => handleDeleteModule(mod.id, mod.name)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-3 pt-0 space-y-1">
            {mod.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Chưa có bài học nào trong chương này.</p>
            ) : (
              mod.items.map((item) => {
                const isExternalUrl = item.type === 'EXTERNAL_URL';
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                    {isExternalUrl ? (
                      <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    ) : completedIds ? (
                      completedIds.has(item.id)
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    {isExternalUrl && item.externalUrl ? (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm truncate hover:text-primary transition-colors"
                      >
                        {item.title}
                      </a>
                    ) : item.lessonId ? (
                      <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}`} className="flex-1 text-sm truncate hover:text-primary transition-colors">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="flex-1 text-sm truncate">{item.title}</span>
                    )}
                    {item.lesson?.estimatedMinutes && (
                      <span className="text-xs text-muted-foreground">{item.lesson.estimatedMinutes} phút</span>
                    )}
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.lessonId && (
                          <Link href={`/courses/${courseSlug}/lessons/${item.lessonId}/edit`} className="text-muted-foreground hover:text-foreground p-0.5">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <button onClick={() => handleToggleItemPublish(item.id)} className="text-muted-foreground hover:text-foreground p-0.5">
                          {item.isPublished ? <Eye className="h-3.5 w-3.5 text-green-600" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {!item.isPublished && <Badge variant="outline" className="text-xs">Ẩn</Badge>}
                  </div>
                );
              })
            )}

            {canManage && (
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/courses/${courseSlug}/lessons/new?moduleId=${mod.id}`}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm bài học
                </Link>
                {openUrlFormId !== mod.id && (
                  <button
                    type="button"
                    onClick={() => setOpenUrlFormId(mod.id)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Thêm link ngoài
                  </button>
                )}
              </div>
            )}
            {canManage && openUrlFormId === mod.id && (
              <AddExternalUrlForm
                moduleId={mod.id}
                onAdded={refresh}
                onClose={() => setOpenUrlFormId(null)}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {canManage && (
        <div>
          {showAddModule ? (
            <AddModuleForm courseId={courseId} onAdded={() => { setShowAddModule(false); refresh(); }} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddModule(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm chương
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
