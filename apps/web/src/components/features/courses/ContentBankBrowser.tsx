'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  BookOpen,
  Brain,
  ClipboardList,
  Code2,
  Copy,
  FileQuestion,
  Library,
  Link2,
  Loader2,
  MessagesSquare,
  Search,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import type { ContentBankResult, ModuleWithItems } from '@lumibach/types';

const TYPE_META: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  LESSON: { label: 'Bài học', icon: BookOpen, color: 'text-teal-500' },
  ASSIGNMENT: { label: 'Bài tập', icon: ClipboardList, color: 'text-blue-500' },
  QUIZ: { label: 'Quiz', icon: Brain, color: 'text-violet-500' },
  PRACTICE_TEST: { label: 'Đề ôn tập', icon: FileQuestion, color: 'text-cyan-500' },
  CODE_EXERCISE: { label: 'Bài code', icon: Code2, color: 'text-fuchsia-500' },
  FORUM: { label: 'Diễn đàn', icon: MessagesSquare, color: 'text-sky-500' },
  EXTERNAL_URL: { label: 'Link ngoài', icon: Link2, color: 'text-amber-500' },
};

type NhomChuong = {
  key: string;
  tenChuong: string;
  /** Kho của danh mục, hoặc tên lớp đang chia sẻ — để biết bài đến từ đâu. */
  nguon: string;
  items: ContentBankResult['items'];
};

/**
 * Gom hoạt động theo (nguồn, chương), giữ nguyên thứ tự API trả về.
 *
 * Khoá nhóm phải gồm cả nguồn: hai lớp khác nhau đều có chương tên "Chủ đề A",
 * gom theo mỗi tên chương sẽ trộn bài của hai lớp vào một chỗ.
 */
function nhomTheoChuong(items: ContentBankResult['items']): NhomChuong[] {
  const map = new Map<string, NhomChuong>();
  for (const item of items) {
    const nguon =
      item.sourceKind === 'BANK'
        ? `Kho chung · ${item.sourceCategoryPath}`
        : `${item.sourceCourseName ?? 'Khoá học'} · ${item.sourceCategoryPath}`;
    const key = `${nguon}||${item.sourceModuleName}`;
    const nhom = map.get(key) ?? { key, tenChuong: item.sourceModuleName, nguon, items: [] };
    nhom.items.push(item);
    map.set(key, nhom);
  }
  return [...map.values()];
}

/**
 * Duyệt ngân hàng nội dung của danh mục và nhân bản hoạt động về một chương.
 *
 * Bản sao luôn ở trạng thái nháp, chưa hiện với học sinh — chép xong giáo viên
 * còn phải chỉnh ngày mở/đóng cho lớp mình rồi mới đăng.
 */
export function ContentBankBrowser({
  courseId,
  modules,
}: {
  courseId: string;
  modules: ModuleWithItems[];
}) {
  const router = useRouter();
  const [data, setData] = useState<ContentBankResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [targetModuleId, setTargetModuleId] = useState(modules[0]?.id ?? '');
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  // Chương nào đang đổ xuống. Mặc định đóng hết: kho của cả một nhánh danh mục
  // dài hàng trăm dòng, đổ sẵn thì giáo viên phải cuộn mãi mới thấy chương cần.
  const [moChuong, setMoChuong] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<ContentBankResult>('/modules/bank', {
        query: { courseId, ...(search ? { q: search } : {}) },
      })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Không tải được ngân hàng nội dung');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, search]);

  function handleCopy(moduleItemId: string) {
    if (!targetModuleId) {
      toast.error('Chọn chương để nhận bản sao.');
      return;
    }
    setCopyingId(moduleItemId);
    startTransition(async () => {
      try {
        await apiClient.post(`/modules/items/${moduleItemId}/copy`, { moduleId: targetModuleId });
        setCopiedIds((prev) => new Set(prev).add(moduleItemId));
        toast.success('Đã nhân bản vào chương. Bản sao đang ở dạng nháp.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi nhân bản hoạt động');
      } finally {
        setCopyingId(null);
      }
    });
  }

  if (modules.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Khoá học chưa có chương nào để nhận nội dung.
        </p>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          Tạo ít nhất một chương ở trang Chương trước khi chép nội dung về.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoạt động..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
        <select
          value={targetModuleId}
          onChange={(e) => setTargetModuleId(e.target.value)}
          className="border-input bg-background text-foreground dark:bg-card h-9 rounded-md border px-3 text-sm"
          title="Chương sẽ nhận bản sao"
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              Chép vào: {m.name}
            </option>
          ))}
        </select>
      </form>

      {loading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải ngân hàng...
        </div>
      ) : loadError ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border border-dashed p-6 text-center text-sm">
          {loadError}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-center">
          <Library className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            {search ? 'Không tìm thấy hoạt động nào khớp.' : 'Ngân hàng nội dung chưa có gì.'}
          </p>
          {!search && (
            <p className="text-muted-foreground/70 max-w-lg text-xs">
              Hoạt động vào đây khi giáo viên của một khoá cùng nhánh danh mục bật “Chia sẻ” cho
              hoạt động đó ở trang Chương.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {data.items.length} hoạt động từ {data.sourceCourseCount} khoá học cùng nhánh danh mục.
          </p>

          {/*
           * Gom theo NGUỒN rồi tới CHƯƠNG. Danh sách phẳng khiến giáo viên phải
           * đọc từng dòng phụ đề mới biết bài nào thuộc chương nào; gom lại thì
           * cấu trúc bài giảng của nguồn hiện ra ngay, và mở đúng chương cần.
           */}
          <div className="space-y-2">
            {nhomTheoChuong(data.items).map((nhom) => {
              const dangMo = moChuong.has(nhom.key);
              return (
                <div
                  key={nhom.key}
                  className="border-border bg-card overflow-hidden rounded-xl border"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setMoChuong((prev) => {
                        const next = new Set(prev);
                        if (next.has(nhom.key)) next.delete(nhom.key);
                        else next.add(nhom.key);
                        return next;
                      })
                    }
                    aria-expanded={dangMo}
                    className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  >
                    {dangMo ? (
                      <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    <FolderOpen className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{nhom.tenChuong}</span>
                      <span className="text-muted-foreground block truncate font-mono text-[11px]">
                        {nhom.nguon}
                      </span>
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {nhom.items.length}
                    </Badge>
                  </button>

                  {dangMo && (
                    <div className="divide-border border-border divide-y border-t">
                      {nhom.items.map((item) => {
                        const meta = TYPE_META[item.type] ?? {
                          label: item.type,
                          icon: Library,
                          color: 'text-muted-foreground',
                        };
                        const Icon = meta.icon;
                        const copied = copiedIds.has(item.moduleItemId);
                        return (
                          <div
                            key={item.moduleItemId}
                            className="flex flex-wrap items-center gap-3 py-3 pr-4 pl-11"
                          >
                            <div className="bg-muted/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                              <Icon className={`h-4 w-4 ${meta.color}`} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold">{item.title}</p>
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  {meta.label}
                                </Badge>
                                {item.detail && (
                                  <span className="text-muted-foreground text-xs">
                                    {item.detail}
                                  </span>
                                )}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant={copied ? 'ghost' : 'outline'}
                              disabled={pending && copyingId === item.moduleItemId}
                              onClick={() => handleCopy(item.moduleItemId)}
                              className="shrink-0"
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              {copied ? 'Chép lần nữa' : 'Chép về chương'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
