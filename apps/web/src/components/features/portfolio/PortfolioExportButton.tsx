'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { exportSheetsToExcel, safeExcelFileName } from '@/lib/export-excel';
import { COMPETENCY_LEVEL_LABEL, EVIDENCE_TYPE_LABEL, type PortfolioData } from '@lumibach/types';

const ACTIVITY_LABEL: Record<string, string> = {
  assignment: 'Bài tập',
  'code-exercise': 'Bài code',
  quiz: 'Quiz',
  'practice-test': 'Đề luyện tập',
};

type Props = {
  courseName: string;
  portfolio: PortfolioData;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function buildSingleStudentSheets(p: PortfolioData) {
  const summary: (string | number | null)[][] = [
    ['Hồ sơ học tập'],
    ['Học sinh', p.student.name],
    ['Email', p.student.email],
    [],
    ['Tổng số bài chấm', p.summary.totalGraded],
    [
      'Điểm trung bình (%)',
      p.summary.averagePercent === null ? '' : Math.round(p.summary.averagePercent),
    ],
    ['Số minh chứng năng lực', p.summary.competencyCount],
    ['Số mục tự đánh giá', p.summary.reflectionCount],
  ];

  const graded: (string | number | null)[][] = [
    ['Hoạt động', 'Loại', 'Điểm', 'Tối đa', 'Tỉ lệ %', 'Trạng thái', 'Nhận xét', 'Ngày'],
    ...p.gradedItems.map((g) => [
      g.title,
      ACTIVITY_LABEL[g.activityType] ?? g.activityType,
      g.score,
      g.maxScore,
      g.score !== null && g.maxScore && g.maxScore > 0
        ? Math.round((g.score / g.maxScore) * 100)
        : null,
      g.status,
      g.feedback ?? '',
      fmtDate(g.date),
    ]),
  ];

  const competency: (string | number | null)[][] = [
    [
      'Danh mục',
      'Mã chỉ báo',
      'Chỉ báo',
      'Mức độ',
      'Loại minh chứng',
      'Hoạt động',
      'Chương / Module',
      'Ghi chú',
      'Ngày chấm',
    ],
    ...p.competencyEvidence.map((e) => [
      e.categoryName,
      e.indicatorCode ?? '',
      e.indicatorName,
      COMPETENCY_LEVEL_LABEL[e.level] ?? e.level,
      e.evidenceType ? (EVIDENCE_TYPE_LABEL[e.evidenceType] ?? e.evidenceType) : '',
      e.activityTitle,
      e.moduleName ?? '',
      e.note ?? '',
      fmtDate(e.gradedAt),
    ]),
  ];

  const reflections: (string | number | null)[][] = [
    ['Tiêu đề', 'Nội dung', 'Tạo lúc', 'Cập nhật'],
    ...p.reflections.map((r) => [r.title, r.content, fmtDate(r.createdAt), fmtDate(r.updatedAt)]),
  ];

  return [
    { name: 'Tom tat', rows: summary },
    { name: 'Bai lam', rows: graded },
    { name: 'Nang luc', rows: competency },
    { name: 'Tu danh gia', rows: reflections },
  ];
}

export function PortfolioExportButton({ courseName, portfolio }: Props) {
  const [busy, setBusy] = useState(false);

  async function exportSingle() {
    setBusy(true);
    try {
      const sheets = buildSingleStudentSheets(portfolio);
      const fileName = `ho-so-${safeExcelFileName(portfolio.student.name)}-${safeExcelFileName(courseName)}`;
      await exportSheetsToExcel({ sheets, fileName });
      toast.success('Đã xuất hồ sơ học tập.');
    } catch (err) {
      console.error('exportSingle error:', err);
      toast.error(err instanceof Error ? err.message : 'Lỗi xuất file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportSingle}
      disabled={busy}
      aria-label="Xuất XLSX hồ sơ của học sinh này"
      className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      <span>{busy ? 'Đang xuất…' : 'Xuất XLSX'}</span>
    </button>
  );
}
