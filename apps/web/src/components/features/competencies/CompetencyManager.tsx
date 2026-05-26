'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FolderTree, ListChecks, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { CompetencyCategoryItem, CompetencyIndicatorItem } from '@lumibach/types';

type Props = {
  courseId: string;
  canManage: boolean;
  categories: CompetencyCategoryItem[];
};

function fmtError(err: unknown, fallback = 'Có lỗi xảy ra'): string {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : fallback;
  if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
    const parts = (err.details as { path?: string; message?: string }[])
      .map((detail) =>
        detail.path ? `${detail.path}: ${detail.message ?? ''}` : (detail.message ?? '')
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  return err.message || fallback;
}

export function CompetencyManager({ courseId, canManage, categories }: Props) {
  const router = useRouter();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function refresh() {
    router.refresh();
  }

  if (categories.length === 0 && !canManage) {
    return (
      <div className="border-border bg-card rounded-lg border border-dashed py-14 text-center">
        <FolderTree className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">Khoá học chưa có danh mục năng lực.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}

      {canManage && (
        <div className="border-border bg-card rounded-lg border p-4">
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Kho năng lực của khoá học</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Tạo danh mục lớn, sau đó thêm các chỉ báo cụ thể để gán vào hoạt động.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowAddCategory(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Thêm danh mục
              </Button>
            </div>
          )}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="border-border bg-card rounded-lg border border-dashed py-14 text-center">
          <FolderTree className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
          <p className="font-semibold">Chưa có năng lực nào</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Tạo danh mục năng lực đầu tiên để bắt đầu xây rubric năng lực cho khoá học.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              canManage={canManage}
              onChanged={refresh}
              openConfirm={openConfirm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  canManage,
  onChanged,
  openConfirm,
}: {
  category: CompetencyCategoryItem;
  canManage: boolean;
  onChanged: () => void;
  openConfirm: (message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [showAddIndicator, setShowAddIndicator] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const ok = await openConfirm(`Xoá danh mục "${category.name}" và toàn bộ chỉ báo bên trong?`);
    if (!ok) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/competencies/categories/${category.id}`);
      toast.success('Đã xoá danh mục năng lực.');
      onChanged();
    } catch (err) {
      toast.error(fmtError(err, 'Lỗi xoá danh mục'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="bg-muted/20 border-b px-4 py-3">
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="bg-primary/10 border-primary/20 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                <FolderTree className="text-primary h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{category.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {category.indicators.length} chỉ báo
                  </Badge>
                </div>
                {category.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{category.description}</p>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Sửa danh mục" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Xoá danh mục"
                  onClick={handleDelete}
                  disabled={deleting}
                  destructive
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="divide-border divide-y">
        {category.indicators.length === 0 ? (
          <p className="text-muted-foreground px-4 py-4 text-sm">
            Chưa có chỉ báo trong danh mục này.
          </p>
        ) : (
          category.indicators.map((indicator) => (
            <IndicatorRow
              key={indicator.id}
              indicator={indicator}
              canManage={canManage}
              onChanged={onChanged}
              openConfirm={openConfirm}
            />
          ))
        )}
      </div>

      {canManage && (
        <div className="border-t px-4 py-3">
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
            <Button variant="ghost" size="sm" onClick={() => setShowAddIndicator(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm chỉ báo
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function IndicatorRow({
  indicator,
  canManage,
  onChanged,
  openConfirm,
}: {
  indicator: CompetencyIndicatorItem;
  canManage: boolean;
  onChanged: () => void;
  openConfirm: (message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const ok = await openConfirm('Xoá chỉ báo năng lực này?');
    if (!ok) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/competencies/indicators/${indicator.id}`);
      toast.success('Đã xoá chỉ báo.');
      onChanged();
    } catch (err) {
      toast.error(fmtError(err, 'Lỗi xoá chỉ báo'));
    } finally {
      setDeleting(false);
    }
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
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <ListChecks className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm leading-relaxed">
            {indicator.code && (
              <span className="text-primary mr-2 font-mono text-xs font-bold">
                {indicator.code}
              </span>
            )}
            {indicator.name}
          </p>
          {indicator.description && (
            <p className="text-muted-foreground mt-1 text-xs">{indicator.description}</p>
          )}
        </div>
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Sửa chỉ báo" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label="Xoá chỉ báo" onClick={handleDelete} disabled={deleting} destructive>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (!cleanName) {
      toast.error('Nhập tên danh mục năng lực.');
      return;
    }
    if (!category && !courseId) {
      toast.error('Thiếu khoá học để tạo danh mục.');
      return;
    }

    setSaving(true);
    try {
      if (category) {
        await apiClient.patch(`/competencies/categories/${category.id}`, {
          name: cleanName,
          description: cleanDescription || null,
        });
        toast.success('Đã cập nhật danh mục.');
      } else {
        await apiClient.post(`/courses/${courseId}/competencies/categories`, {
          name: cleanName,
          description: cleanDescription || undefined,
        });
        toast.success('Đã thêm danh mục.');
      }
      onDone();
    } catch (err) {
      toast.error(fmtError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        autoFocus
        placeholder="Tên danh mục năng lực"
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
      />
      <Textarea
        placeholder="Mô tả hoặc phạm vi đánh giá"
        value={description}
        maxLength={2000}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
      />
      <FormActions
        saving={saving}
        submitLabel={category ? 'Lưu danh mục' : 'Thêm danh mục'}
        onCancel={onCancel}
      />
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
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const cleanCode = code.trim();
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (!cleanName) {
      toast.error('Nhập nội dung chỉ báo năng lực.');
      return;
    }

    setSaving(true);
    try {
      if (indicator) {
        await apiClient.patch(`/competencies/indicators/${indicator.id}`, {
          code: cleanCode || null,
          name: cleanName,
          description: cleanDescription || null,
        });
        toast.success('Đã cập nhật chỉ báo.');
      } else {
        await apiClient.post(`/competencies/categories/${categoryId}/indicators`, {
          code: cleanCode || null,
          name: cleanName,
          description: cleanDescription || null,
        });
        toast.success('Đã thêm chỉ báo.');
      }
      onDone();
    } catch (err) {
      toast.error(fmtError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <Input
          placeholder="Mã"
          value={code}
          maxLength={50}
          onChange={(event) => setCode(event.target.value)}
        />
        <Input
          autoFocus
          placeholder="Nội dung chỉ báo năng lực"
          value={name}
          maxLength={2000}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Textarea
        placeholder="Mô tả hoặc ví dụ minh chứng"
        value={description}
        maxLength={2000}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
      />
      <FormActions
        saving={saving}
        submitLabel={indicator ? 'Lưu chỉ báo' : 'Thêm chỉ báo'}
        onCancel={onCancel}
      />
    </form>
  );
}

function FormActions({
  saving,
  submitLabel,
  onCancel,
}: {
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={saving}>
        <Save className="mr-1.5 h-3.5 w-3.5" />
        {saving ? 'Đang lưu...' : submitLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        <X className="mr-1.5 h-3.5 w-3.5" />
        Huỷ
      </Button>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md p-1.5 transition-colors disabled:opacity-50',
        destructive
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
