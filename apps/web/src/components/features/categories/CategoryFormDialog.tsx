'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CategoryTreePicker } from './CategoryTreePicker';
import {
  createCategoryAction,
  updateCategoryAction,
} from '@/app/(dashboard)/admin/categories/actions';
import type { CategoryListItem, CategoryTreeNode } from '@lumibach/types';

type Mode =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; category: CategoryListItem };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: Mode;
  onSuccess?: () => void;
  categoryTree?: CategoryTreeNode[];
};

export function CategoryFormDialog({ open, onOpenChange, config, onSuccess, categoryTree }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (config.mode === 'create') {
      setName('');
      setDescription('');
      setParentId(config.parentId);
      setSortOrder(0);
    } else {
      setName(config.category.name);
      setDescription(config.category.description ?? '');
      setParentId(config.category.parentId);
      setSortOrder(config.category.sortOrder);
    }
  }, [open, config]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tên danh mục không được trống');
      return;
    }
    startTransition(async () => {
      const result =
        config.mode === 'create'
          ? await createCategoryAction({
              name: name.trim(),
              description: description.trim() || undefined,
              parentId,
              sortOrder,
            })
          : await updateCategoryAction(config.category.id, {
              name: name.trim(),
              description: description.trim() || undefined,
              parentId,
              sortOrder,
            });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success(config.mode === 'create' ? 'Tạo danh mục thành công' : 'Cập nhật thành công');
      onSuccess?.();
      onOpenChange(false);
    });
  }

  const title = config.mode === 'create' ? 'Tạo danh mục mới' : 'Sửa danh mục';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Tên *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Khối 10 hoặc 10E1"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Mô tả</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="(tuỳ chọn)"
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Danh mục cha</Label>
            <CategoryTreePicker
              value={parentId}
              onChange={setParentId}
              leafOnly={false}
              allowClear
              initialTree={categoryTree}
              placeholder="(Không có — đặt làm danh mục gốc)"
            />
            <p className="text-muted-foreground text-xs">
              Để trống nếu đây là danh mục gốc (vd: năm học).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-sort">Thứ tự sắp xếp</Label>
            <Input
              id="cat-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang lưu...' : config.mode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
