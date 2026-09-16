'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { MathText } from '@/components/ui/editor/MathText';
import { apiClient } from '@/lib/api-client';
import { parseQuestions } from '@/lib/word-import/parse-questions';
import type { DocLine, ParsedQuestion } from '@/lib/word-import/types';
import { QUESTION_TYPE_BADGE, QUESTION_TYPE_LABEL } from '@/lib/question-type-labels';
import { cn } from '@/lib/utils';

/**
 * Nhập đề từ tệp Word.
 *
 * Luôn đi qua bước xem trước, không bao giờ nhập thẳng. File Word mỗi người
 * trình bày một kiểu, nên thứ duy nhất đáng tin là giáo viên nhìn tận mắt từng
 * câu đã dựng ra sao — công thức, hình, phương án — rồi mới bấm nhập.
 */

type Props = {
  /** Đúng một trong hai: nhập vào kho của khoá học, hay ngân hàng của danh mục. */
  courseId?: string;
  bankCategoryId?: string;
  /** Nơi quay về sau khi nhập xong. */
  returnTo: string;
  tenNoiNhan: string;
};

type KetQuaDoc = {
  lines: DocLine[];
  congThucDaDoi: number;
  congThucThatBai: number;
  anhDaLuu: number;
  anhLoi: number;
};

export function WordImportWorkspace({ courseId, bankCategoryId, returnTo, tenNoiNhan }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tenTep, setTenTep] = useState('');
  const [dangDoc, setDangDoc] = useState(false);
  const [dangNhap, setDangNhap] = useState(false);
  const [ketQuaDoc, setKetQuaDoc] = useState<KetQuaDoc | null>(null);
  const [cauHoi, setCauHoi] = useState<ParsedQuestion[]>([]);
  const [loiChung, setLoiChung] = useState<string[]>([]);
  const [boQua, setBoQua] = useState<Set<number>>(new Set());

  const hopLe = useMemo(
    () => cauHoi.map((q, i) => ({ q, i })).filter(({ q }) => q.loi.length === 0),
    [cauHoi]
  );
  const seNhap = useMemo(() => hopLe.filter(({ i }) => !boQua.has(i)), [hopLe, boQua]);
  const soLoi = cauHoi.length - hopLe.length;

  async function chonTep(file: File) {
    setTenTep(file.name);
    setDangDoc(true);
    setKetQuaDoc(null);
    setCauHoi([]);
    setLoiChung([]);
    setBoQua(new Set());
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/word-import', { method: 'POST', body: fd });
      const data = (await res.json()) as KetQuaDoc & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không đọc được tệp.');

      setKetQuaDoc(data);
      const kq = parseQuestions(data.lines);
      setCauHoi(kq.questions);
      setLoiChung(kq.loiChung);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đọc được tệp.');
      setTenTep('');
    } finally {
      setDangDoc(false);
    }
  }

  async function nhap() {
    if (seNhap.length === 0 || dangNhap) return;
    setDangNhap(true);
    try {
      const res = await apiClient.post<{ message?: string }>('/questions/import', {
        courseId: courseId ?? null,
        bankCategoryId: bankCategoryId ?? null,
        questions: seNhap.map(({ q }) => ({
          type: q.type,
          content: q.content,
          explanation: q.explanation,
          points: q.points,
          folder: q.folder,
          options: q.options,
          testCases: q.testCases,
          starterCode: q.starterCode,
          solutionCode: q.solutionCode,
          timeLimit: q.timeLimit,
          memoryLimit: q.memoryLimit,
        })),
      });
      toast.success(res?.message || 'Đã nhập xong.');
      router.push(returnTo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nhập không thành công.');
    } finally {
      setDangNhap(false);
    }
  }

  function doiBoQua(i: number) {
    setBoQua((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Chọn tệp */}
      <div className="border-border bg-card space-y-3 rounded-2xl border p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Nhập đề từ tệp Word</h2>
          <p className="text-muted-foreground text-sm">
            Câu hỏi sẽ vào {tenNoiNhan}. Tệp phải theo mẫu: mỗi câu mở đầu bằng{' '}
            <code className="bg-muted rounded px-1 font-mono text-xs">Câu 1.</code> và mã loại đặt
            trong ngoặc vuông.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void chonTep(f);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={dangDoc}>
            {dangDoc ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {dangDoc ? 'Đang đọc tệp...' : 'Chọn tệp .docx'}
          </Button>
          <a
            href="/api/word-import/mau"
            download
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline"
          >
            <Download className="h-3.5 w-3.5" />
            Tải tệp mẫu
          </a>
          {tenTep && <span className="text-muted-foreground text-sm">{tenTep}</span>}
        </div>

        {ketQuaDoc && (
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span>Công thức đọc được: {ketQuaDoc.congThucDaDoi}</span>
            {ketQuaDoc.congThucThatBai > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Công thức không đọc được: {ketQuaDoc.congThucThatBai}
              </span>
            )}
            <span>Ảnh đã lưu: {ketQuaDoc.anhDaLuu}</span>
            {ketQuaDoc.anhLoi > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Ảnh bỏ qua: {ketQuaDoc.anhLoi}
              </span>
            )}
          </div>
        )}
      </div>

      {loiChung.length > 0 && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-xl border px-4 py-3 text-sm">
          {loiChung.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}

      {/* Xem trước */}
      {cauHoi.length > 0 && (
        <>
          <div className="border-border bg-card sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3 shadow-sm">
            <div className="text-sm">
              <span className="font-semibold">{seNhap.length}</span> câu sẽ được nhập
              {soLoi > 0 && (
                <span className="text-destructive"> · {soLoi} câu lỗi, không nhập được</span>
              )}
              {boQua.size > 0 && (
                <span className="text-muted-foreground"> · {boQua.size} câu bạn bỏ chọn</span>
              )}
            </div>
            <Button onClick={() => void nhap()} disabled={seNhap.length === 0 || dangNhap}>
              {dangNhap ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Nhập {seNhap.length} câu
            </Button>
          </div>

          <div className="space-y-4 pb-12">
            {cauHoi.map((q, i) => {
              const coLoi = q.loi.length > 0;
              const biBoQua = boQua.has(i);
              return (
                <div
                  key={i}
                  className={cn(
                    'space-y-3 rounded-xl border px-5 py-4',
                    coLoi
                      ? 'border-destructive/40 bg-destructive/5'
                      : biBoQua
                        ? 'border-border bg-muted/30 opacity-60'
                        : 'border-border bg-card'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {coLoi ? (
                      <XCircle className="text-destructive h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    <span className="text-sm font-semibold">{q.nhan}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        QUESTION_TYPE_BADGE[q.type] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {QUESTION_TYPE_LABEL[q.type] ?? q.type}
                    </span>
                    <span className="text-muted-foreground text-xs">{q.points} điểm</span>
                    {q.folder && (
                      <span className="text-muted-foreground text-xs">· {q.folder}</span>
                    )}
                    {!coLoi && (
                      <button
                        onClick={() => doiBoQua(i)}
                        className="text-muted-foreground hover:text-foreground ml-auto text-xs underline"
                      >
                        {biBoQua ? 'Nhập câu này' : 'Bỏ qua câu này'}
                      </button>
                    )}
                  </div>

                  {q.loi.map((l, j) => (
                    <p key={j} className="text-destructive text-xs">
                      {l}
                    </p>
                  ))}
                  {q.canhBao.map((l, j) => (
                    <p
                      key={j}
                      className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {l}
                    </p>
                  ))}

                  <RichTextView html={q.content} className="text-sm" />

                  {q.options.length > 0 && (
                    <ul className="space-y-1">
                      {q.options.map((o, oi) => (
                        <li
                          key={oi}
                          className={cn(
                            'text-sm',
                            o.isCorrect
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {o.isCorrect ? '✓' : '·'} <MathText text={moTaMuc(q.type, o.content)} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {q.starterCode && (
                    <pre className="bg-muted/50 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs whitespace-pre">
                      {q.starterCode}
                    </pre>
                  )}

                  {q.testCases.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {q.testCases.length} test case
                      {q.testCases.some((t) => t.isHidden)
                        ? ` (${q.testCases.filter((t) => t.isHidden).length} ẩn)`
                        : ''}
                    </p>
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

/** Cặp ghép nối lưu dưới dạng JSON; bày lại thành "trái → phải" cho dễ soát. */
function moTaMuc(type: string, content: string): string {
  if (type !== 'MATCHING') return content;
  try {
    const p = JSON.parse(content) as { left?: string; right?: string };
    return `${p.left ?? ''} → ${p.right ?? ''}`;
  } catch {
    return content;
  }
}
