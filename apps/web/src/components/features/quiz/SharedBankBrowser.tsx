'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient, ApiError } from '@/lib/api-client';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { Copy, Library, Search, Loader2 } from 'lucide-react';
import type { QuestionBankResult, QuestionCategory } from '@lumibach/types';

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm nhiều đáp án',
  TRUE_FALSE: 'Đúng / Sai',
  TRUE_FALSE_MULTI: 'Đúng / Sai nhiều ý',
  ESSAY: 'Tự luận',
  MATCHING: 'Ghép nối',
  ORDERING: 'Sắp xếp',
  PARSONS: 'Parsons',
  CODE_FILL: 'Điền vào code',
  CODE_PYTHON: 'Code Python',
  CODE_CPP: 'Code C++',
  CODE_WEB: 'Code Web',
  CODE_DEBUG_PYTHON: 'Sửa lỗi Python',
  CODE_DEBUG_CPP: 'Sửa lỗi C++',
};

/**
 * Duyệt ngân hàng câu hỏi dùng chung của danh mục và sao chép về khoá học.
 *
 * Chép chứ không dùng chung bản ghi: mỗi lớp tự chủ đề của mình, sửa bên này
 * không làm đổi đề lớp khác đang kiểm tra dở.
 */
export function SharedBankBrowser({
  courseId,
  categories,
}: {
  courseId: string;
  /** Kho câu hỏi trong khoá học này — chọn nơi cất bản sao. */
  categories: QuestionCategory[];
}) {
  const router = useRouter();
  const [data, setData] = useState<QuestionBankResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<QuestionBankResult>('/questions/bank', {
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
          setLoadError(err instanceof ApiError ? err.message : 'Không tải được ngân hàng câu hỏi');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, search]);

  function handleCopy(questionId: string) {
    setCopyingId(questionId);
    startTransition(async () => {
      try {
        await apiClient.post(`/questions/${questionId}/copy`, {
          courseId,
          categoryId: targetCategoryId || null,
        });
        setCopiedIds((prev) => new Set(prev).add(questionId));
        toast.success('Đã sao chép câu hỏi về kho của khoá học.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi sao chép câu hỏi');
      } finally {
        setCopyingId(null);
      }
    });
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
            placeholder="Tìm trong nội dung câu hỏi..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
        {categories.length > 0 && (
          <select
            value={targetCategoryId}
            onChange={(e) => setTargetCategoryId(e.target.value)}
            className="border-input bg-background text-foreground dark:bg-card h-9 rounded-md border px-3 text-sm"
            title="Bản sao sẽ nằm trong kho nào của khoá học này"
          >
            <option value="">Chép vào: ngoài danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                Chép vào: {c.name}
              </option>
            ))}
          </select>
        )}
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
      ) : !data || data.questions.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-center">
          <Library className="text-muted-foreground/30 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            {search ? 'Không tìm thấy câu hỏi nào khớp.' : 'Ngân hàng chung chưa có câu hỏi nào.'}
          </p>
          {!search && (
            <p className="text-muted-foreground/70 max-w-lg text-xs">
              Câu hỏi vào đây khi giáo viên của một khoá cùng nhánh danh mục bật “Chia sẻ” cho câu
              hỏi đó trong ngân hàng riêng của họ.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {data.questions.length} câu hỏi từ {data.sourceCourseCount} khoá học cùng nhánh danh
            mục.
          </p>
          <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
            {data.questions.map((item) => {
              const copied = copiedIds.has(item.id);
              return (
                <div key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABEL[item.type] ?? item.type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{item.points} điểm</span>
                      {item.optionCount > 0 && (
                        <span className="text-muted-foreground text-xs">
                          · {item.optionCount} lựa chọn
                        </span>
                      )}
                    </div>
                    <RichTextView
                      html={item.content}
                      className="line-clamp-3 text-sm [&_img]:max-h-24"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Nguồn: {item.sourceCourseName}
                      {item.sourceCategoryName ? ` · ${item.sourceCategoryName}` : ''} ·{' '}
                      {item.sourceCategoryPath}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={copied ? 'ghost' : 'outline'}
                    disabled={pending && copyingId === item.id}
                    onClick={() => handleCopy(item.id)}
                    className="shrink-0"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {copied ? 'Chép lần nữa' : 'Chép về khoá'}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
