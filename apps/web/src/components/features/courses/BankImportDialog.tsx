'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Search, X } from 'lucide-react';
import type { CourseActivityPickGroup } from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button, buttonVariants } from '@/components/ui/button';
import { ACTIVITY_TYPE_LABEL } from '@/lib/activity-owner';
import { cn } from '@/lib/utils';

/**
 * Chọn một hoạt động đang có trong lớp rồi chép thành BẢN MẪU RIÊNG của kho.
 *
 * Khác nút "Chia sẻ" ở trang Chương: chia sẻ chỉ bật cờ trên hoạt động của lớp
 * nên kho phụ thuộc vào lớp đó; ở đây kho giữ bản của chính nó.
 *
 * Danh sách chỉ tải khi mở hộp thoại — nó quét mọi chương của mọi lớp người dùng
 * quản lý, không đáng để chạy mỗi lần vào trang kho.
 */
export function BankImportDialog({
  moduleId,
  moduleName,
  onClose,
}: {
  moduleId: string;
  moduleName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [groups, setGroups] = useState<CourseActivityPickGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let huy = false;
    apiClient
      .get<CourseActivityPickGroup[]>('/modules/bank-importable')
      .then((data) => {
        if (!huy) setGroups(data);
      })
      .catch((err: unknown) => {
        if (!huy) {
          setLoadError(
            err instanceof ApiError ? err.message : 'Không tải được danh sách hoạt động.'
          );
        }
      });
    return () => {
      huy = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const tu = q.trim().toLowerCase();
    if (!groups) return [];
    if (!tu) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.title.toLowerCase().includes(tu) ||
            i.moduleName.toLowerCase().includes(tu) ||
            g.courseName.toLowerCase().includes(tu)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  function chep(moduleItemId: string, title: string) {
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/bank-modules/${moduleId}/import`, { moduleItemId });
        toast.success(`Đã chép “${title}” vào kho.`);
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Không chép được hoạt động.');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Chép hoạt động từ lớp vào kho"
    >
      <div className="bg-card border-border flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border shadow-xl">
        <header className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Chép hoạt động từ lớp vào kho</h2>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              Bản sao sẽ nằm trong chương “{moduleName}” và độc lập với lớp nguồn.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-border border-b px-5 py-3">
          <div className="relative">
            <Search className="text-muted-foreground/50 absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên hoạt động, chương hoặc lớp…"
              className="border-input bg-background h-9 w-full rounded-md border pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <p className="text-destructive py-8 text-center text-sm">{loadError}</p>
          ) : !groups ? (
            <p className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải hoạt động của các lớp…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {groups.length === 0
                ? 'Các lớp bạn quản lý chưa có hoạt động nào để chép.'
                : 'Không có hoạt động nào khớp từ khoá.'}
            </p>
          ) : (
            <div className="space-y-5">
              {filtered.map((group) => (
                <section key={group.courseId} className="space-y-1.5">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {group.courseName}
                  </h3>
                  <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
                    {group.items.map((item) => (
                      <li key={item.moduleItemId} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {ACTIVITY_TYPE_LABEL[item.type] ?? item.type} · {item.moduleName}
                            {item.detail ? ` · ${item.detail}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => chep(item.moduleItemId, item.title)}
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'shrink-0 text-xs'
                          )}
                        >
                          Chép vào kho
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="border-border flex justify-end border-t px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Đóng
          </Button>
        </footer>
      </div>
    </div>
  );
}
