'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportRowsToCsv } from '@/lib/export-csv';
import { exportRowsToExcel, safeExcelFileName } from '@/lib/export-excel';
import type { ClusteringDataset as Dataset, ClusteringStudentRow } from '@lumibach/types';

type Props = {
  courseSlug: string;
};

// Làm tròn để HIỂN THỊ; export giữ nguyên giá trị gốc.
function fmtCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3);
  }
  return String(value);
}

function buildRows(data: Dataset): (string | number | null)[][] {
  const header = data.columns.map((c) => c.label);
  const keys = data.columns.map((c) => c.key as keyof ClusteringStudentRow);
  const body = data.rows.map((row) => keys.map((k) => row[k] ?? null));
  return [header, ...body];
}

export function ClusteringDataset({ courseSlug }: Props) {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Dataset>(
        `/analytics/course/${courseSlug}/clustering-dataset`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSlug]);

  function exportCsv() {
    if (!data) return;
    exportRowsToCsv({
      rows: buildRows(data),
      fileName: `phan-cum-${safeExcelFileName(data.course.name)}`,
    });
    toast.success(`Đã xuất CSV ${data.rows.length} học sinh.`);
  }

  async function exportXlsx() {
    if (!data) return;
    await exportRowsToExcel({
      rows: buildRows(data),
      fileName: `phan-cum-${safeExcelFileName(data.course.name)}`,
      sheetName: 'Phan cum',
    });
    toast.success(`Đã xuất XLSX ${data.rows.length} học sinh.`);
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tổng hợp dữ liệu…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive text-sm">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-input hover:bg-accent inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Thử lại
        </button>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Khoá học chưa có học sinh để tổng hợp.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {data.studentCount} học sinh · {data.columns.length} cột · tạo lúc{' '}
          {new Date(data.generatedAt).toLocaleString('vi-VN')}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" /> Xuất CSV
          </button>
          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" /> Xuất XLSX
          </button>
        </div>
      </div>

      <div className="border-border max-h-[70vh] overflow-auto rounded-xl border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              {data.columns.map((c) => (
                <th
                  key={c.key}
                  className="border-border text-muted-foreground border-b px-2 py-2 text-left font-medium whitespace-nowrap"
                  title={c.group}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {data.rows.map((row) => (
              <tr key={row.studentCode} className="hover:bg-muted/40">
                {data.columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                    {fmtCell(row[c.key as keyof ClusteringStudentRow])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
