'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, FolderTree, ListChecks } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { CompetencyCategoryItem, CompetencyIndicatorItem } from '@lumibach/types';

type Props = {
  courseId: string;
  canManage: boolean;
  categories: CompetencyCategoryItem[];
};

export function CompetencyManager({ courseId, canManage, categories }: Props) {
  const router = useRouter();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function refresh() {
    router.refresh();
  }

  if (categories.length === 0 && !canManage) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-lg border py-12 text-center text-sm">
        Chưa có danh mục năng lực nào.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}

      {canManage && (
        <div>
          {showAddCategory ? (
            <CategoryForm
              courseId={courseId}
              onDone={() => {
                setShowAddCategory(false);
                refresh();
              }}
              onCancel={() => setShowAddCategory(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddCategory(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm danh mục năng lực
            </Button>
          )}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground rounded-lg border py-12 text-center text-sm">
          Chưa có danh mục năng lực. Nhấn “Thêm danh mục năng lực” để bắt đầu.
        </div>
      ) : (
        categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            canManage={canManage}
            onChanged={refresh}
            openConfirm={openConfirm}
          />
        ))
      )}
    </div>
  );
}

// ── Category card ──────────────────────────────────────────────

function CategoryCard({
  category,
  canManage,
  onChanged,
  openConfirm,
}: {
  category: CompetencyCategoryItem;
  canManage: boolean;
  onChanged: () => void;
  openConfirm: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [showAddIndicator, setShowAddIndicator] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    const ok = await openConfirm(`Xoá danh mục “${category.name}” và toàn bộ chỉ báo bên trong?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/competencies/categories/${category.id}`);
        toast.success('Đã xoá danh mục năng lực.');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá danh mục');
      }
    });
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/30 border-b px-4 py-3">
        {editing ? (
          <CategoryForm
            category={category}
            onDone={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <FolderTree className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{category.name}</p>
                {category.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{category.description}</p>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                  title="Sửa"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  title="Xoá"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="divide-border divide-y">
        {category.indicators.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">Chưa có chỉ báo.</p>
        ) : (
          category.indicators.map((ind) => (
            <IndicatorRow
              key={ind.id}
              indicator={ind}
              canManage={canManage}
              onChanged={onChanged}
              openConfirm={openConfirm}
            />
          ))
        )}
      </div>

      {canManage && (
        <div className="border-border border-t px-4 py-3">
          {showAddIndicator ? (
            <IndicatorForm
              categoryId={category.id}
              onDone={() => {
                setShowAddIndicator(false);
                onChanged();
              }}
              onCancel={() => setShowAddIndicator(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddIndicator(true)}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Thêm chỉ báo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Indicator row ──────────────────────────────────────────────

function IndicatorRow({
  indicator,
  canManage,
  onChanged,
  openConfirm,
}: {
  indicator: CompetencyIndicatorItem;
  canManage: boolean;
  onChanged: () => void;
  openConfirm: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    const ok = await openConfirm(`Xoá chỉ báo này?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/competencies/indicators/${indicator.id}`);
        toast.success('Đã xoá chỉ báo.');
        onChanged();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá chỉ báo');
      }
    });
  }

  if (editing) {
    return (
      <div className="px-4 py-3">
        <IndicatorForm
          categoryId={indicator.categoryId}
          indicator={indicator}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <ListChecks className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm">
            {indicator.code && (
              <Badge variant="outline" className="mr-2 font-mono text-[11px]">
                {indicator.code}
              </Badge>
            )}
            {indicator.name}
          </p>
          {indicator.description && (
            <p className="text-muted-foreground mt-0.5 text-xs">{indicator.description}</p>
          )}
        </div>
      </div>
      {canManage && (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Sửa"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive p-1 transition-colors"
            title="Xoá"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Forms ──────────────────────────────────────────────────────

function CategoryForm({
  courseId,
  category,
  onDone,
  onCancel,
}: {
  courseId?: string;
  category?: CompetencyCategoryItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nhập tên danh mục.');
      return;
    }
    startTransition(async () => {
      try {
        if (category) {
          await apiClient.patch(`/competencies/categories/${category.id}`, {
            name: name.trim(),
            description: description.trim() || null,
          });
          toast.success('Đã cập nhật danh mục.');
        } else {
          await apiClient.post(`/courses/${courseId}/competencies/categories`, {
            name: name.trim(),
            description: description.trim() || undefined,
          });
          toast.success('Đã thêm danh mục.');
        }
        onDone();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Có lỗi xảy ra');
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Input
        autoFocus
        placeholder="Tên danh mục năng lực (vd: Tư duy thuật toán)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Textarea
        placeholder="Mô tả (tuỳ chọn)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Đang lưu...' : category ? 'Lưu' : 'Thêm'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" />
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function IndicatorForm({
  categoryId,
  indicator,
  onDone,
  onCancel,
}: {
  categoryId: string;
  indicator?: CompetencyIndicatorItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(indicator?.code ?? '');
  const [name, setName] = useState(indicator?.name ?? '');
  const [description, setDescription] = useState(indicator?.description ?? '');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nhập nội dung chỉ báo.');
      return;
    }
    startTransition(async () => {
      try {
        if (indicator) {
          await apiClient.patch(`/competencies/indicators/${indicator.id}`, {
            code: code.trim() || null,
            name: name.trim(),
            description: description.trim() || null,
          });
          toast.success('Đã cập nhật chỉ báo.');
        } else {
          await apiClient.post(`/competencies/categories/${categoryId}/indicators`, {
            code: code.trim() || null,
            name: name.trim(),
            description: description.trim() || null,
          });
          toast.success('Đã thêm chỉ báo.');
        }
        onDone();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Có lỗi xảy ra');
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Mã (vd 1.1)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-28 shrink-0"
        />
        <Input
          autoFocus
          placeholder="Nội dung chỉ báo năng lực"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
      </div>
      <Textarea
        placeholder="Mô tả / minh hoạ (tuỳ chọn)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Đang lưu...' : indicator ? 'Lưu' : 'Thêm'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" />
          Huỷ
        </Button>
      </div>
    </form>
  );
}
