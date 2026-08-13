'use client';

import { useRef, useState, useTransition } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient, ApiError } from '@/lib/api-client';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { ImportCompetenciesResult, ImportCompetencyRow } from '@lumibach/types';

// Tên cột chấp nhận được, cả tiếng Việt lẫn tiếng Anh — giáo viên hay sửa lại
// tiêu đề của file mẫu nên đọc theo nhiều biến thể thay vì bắt gõ đúng.
const COLUMN_ALIASES = {
  categoryName: ['danh mục', 'danh muc', 'nhóm năng lực', 'category', 'category name'],
  categoryDescription: ['mô tả danh mục', 'mo ta danh muc', 'category description'],
  code: ['mã', 'ma', 'mã chỉ báo', 'code'],
  name: ['chỉ báo', 'chi bao', 'nội dung chỉ báo', 'indicator', 'name'],
  description: ['mô tả', 'mo ta', 'mô tả chỉ báo', 'description'],
} satisfies Record<keyof ImportCompetencyRow, string[]>;

const TEMPLATE_ROWS = [
  {
    'Danh mục': 'Năng lực giải quyết vấn đề với sự hỗ trợ của máy tính',
    'Mô tả danh mục': 'NLc theo Chương trình GDPT 2018 môn Tin học',
    Mã: 'NLc1',
    'Chỉ báo': 'Phân tích được bài toán và xác định dữ liệu đầu vào, đầu ra',
    'Mô tả': 'Minh chứng: phiếu phân tích bài toán, sơ đồ khối',
  },
  {
    'Danh mục': 'Năng lực giải quyết vấn đề với sự hỗ trợ của máy tính',
    'Mô tả danh mục': '',
    Mã: 'NLc2',
    'Chỉ báo': 'Viết được chương trình giải bài toán bằng ngôn ngữ lập trình bậc cao',
    'Mô tả': '',
  },
  {
    'Danh mục': 'Năng lực sử dụng và quản lí các phương tiện công nghệ thông tin',
    'Mô tả danh mục': 'NLa',
    Mã: 'NLa1',
    'Chỉ báo': 'Sử dụng đúng cách các thiết bị thông dụng của máy tính',
    'Mô tả': '',
  },
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Dựng bản đồ tiêu đề cột trong file → trường dữ liệu. */
function mapColumns(headers: string[]): Partial<Record<keyof ImportCompetencyRow, string>> {
  const found: Partial<Record<keyof ImportCompetencyRow, string>> = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof ImportCompetencyRow,
      string[],
    ][]) {
      if (!found[field] && aliases.includes(norm)) found[field] = header;
    }
  }
  return found;
}

export function downloadCompetencyTemplate() {
  const ws = utils.json_to_sheet(TEMPLATE_ROWS);
  ws['!cols'] = [{ wch: 45 }, { wch: 35 }, { wch: 10 }, { wch: 60 }, { wch: 40 }];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Năng lực');
  writeFile(wb, 'mau-import-nang-luc.xlsx');
}

type Props = {
  courseId: string;
  onClose: () => void;
  onImported: () => void;
};

export function CompetencyImportDialog({ courseId, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportCompetencyRow[]>([]);
  const [filename, setFilename] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCompetenciesResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFilename(file.name);
    setResult(null);
    setParseError(null);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = read(ev.target?.result, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = sheetName ? wb.Sheets[sheetName] : undefined;
        if (!ws) {
          setParseError('File không có sheet nào đọc được.');
          return;
        }

        const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (raw.length === 0) {
          setParseError('Sheet đầu tiên không có dòng dữ liệu nào.');
          return;
        }

        const cols = mapColumns(Object.keys(raw[0] as object));
        if (!cols.categoryName || !cols.name) {
          setParseError(
            'Không tìm thấy cột "Danh mục" và "Chỉ báo". Tải file mẫu để xem đúng tiêu đề cột.'
          );
          return;
        }

        const text = (row: Record<string, unknown>, key?: string) =>
          key ? String(row[key] ?? '').trim() : '';

        const parsed = raw
          .map((row) => ({
            categoryName: text(row, cols.categoryName),
            categoryDescription: text(row, cols.categoryDescription) || undefined,
            code: text(row, cols.code) || undefined,
            name: text(row, cols.name),
            description: text(row, cols.description) || undefined,
          }))
          // Dòng trống cuối bảng là chuyện thường trong Excel — bỏ im lặng.
          .filter((r) => r.categoryName && r.name);

        if (parsed.length === 0) {
          setParseError('Mọi dòng đều thiếu danh mục hoặc nội dung chỉ báo.');
          return;
        }
        setRows(parsed);
      } catch {
        setParseError('Không đọc được file. Hãy dùng định dạng .xlsx hoặc .csv.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleImport() {
    startTransition(async () => {
      try {
        const data = await apiClient.post<ImportCompetenciesResult>(
          `/courses/${courseId}/competencies/import`,
          { rows }
        );
        setResult(data);
        toast.success(
          `Đã thêm ${data.indicatorsCreated} chỉ báo vào ${
            data.categoriesCreated + data.categoriesReused
          } danh mục.`
        );
        onImported();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi import năng lực');
      }
    });
  }

  const categoryCount = new Set(rows.map((r) => r.categoryName.toLocaleLowerCase('vi'))).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="border-border bg-card relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <FileSpreadsheet className="text-primary h-4 w-4" />
              Import năng lực từ Excel
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Mỗi dòng là một chỉ báo. Danh mục lặp lại ở nhiều dòng sẽ được gom thành một.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadCompetencyTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              Tải file mẫu
            </Button>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              Chọn file Excel
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {filename && <p className="text-muted-foreground text-xs">Đã chọn: {filename}</p>}

          {parseError && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
              {parseError}
            </p>
          )}

          {result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{result.indicatorsCreated} chỉ báo mới</Badge>
                <Badge variant="secondary">{result.categoriesCreated} danh mục mới</Badge>
                {result.categoriesReused > 0 && (
                  <Badge variant="secondary">{result.categoriesReused} danh mục dùng lại</Badge>
                )}
                {result.indicatorsSkipped > 0 && (
                  <Badge variant="outline">{result.indicatorsSkipped} bỏ qua (đã có)</Badge>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  {result.errors.map((e) => (
                    <p key={e.row} className="text-destructive text-xs">
                      Dòng {e.row}: {e.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm">
                  Đọc được <strong>{rows.length}</strong> chỉ báo trong{' '}
                  <strong>{categoryCount}</strong> danh mục.
                </p>
                <div className="border-border max-h-64 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0 text-left">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Danh mục</th>
                        <th className="px-3 py-2 font-semibold">Mã</th>
                        <th className="px-3 py-2 font-semibold">Chỉ báo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-border/60 border-t">
                          <td className="px-3 py-1.5">{r.categoryName}</td>
                          <td className="text-primary px-3 py-1.5 font-mono">{r.code ?? ''}</td>
                          <td className="px-3 py-1.5">{r.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && (
                  <p className="text-muted-foreground text-xs">
                    Chỉ hiện 50 dòng đầu, khi import sẽ chạy đủ {rows.length} dòng.
                  </p>
                )}
              </div>
            )
          )}
        </div>

        <div className="border-border flex shrink-0 justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            {result ? 'Đóng' : 'Huỷ'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={rows.length === 0 || pending}>
              {pending ? 'Đang import...' : `Import ${rows.length} chỉ báo`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
