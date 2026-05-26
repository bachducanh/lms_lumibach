'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Users } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportSheetsToExcel, safeExcelFileName } from '@/lib/export-excel';
import {
  COMPETENCY_LEVEL_LABEL,
  EVIDENCE_TYPE_LABEL,
  type CourseMembersResponse,
  type PortfolioData,
} from '@lumibach/types';

const ACTIVITY_LABEL: Record<string, string> = {
  assignment: 'Bài tập',
  'code-exercise': 'Bài code',
  quiz: 'Quiz',
  'practice-test': 'Đề luyện tập',
};

type Props = {
  courseId: string;
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

function buildSingleStudentSheets(p: PortfolioData) {
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

export function PortfolioExportButton({ courseId, courseName, portfolio }: Props) {
  const [busy, setBusy] = useState<'single' | 'all' | null>(null);

  async function exportSingle() {
    setBusy('single');
    try {
      const sheets = buildSingleStudentSheets(portfolio);
      const fileName = `ho-so-${safeExcelFileName(portfolio.student.name)}-${safeExcelFileName(courseName)}`;
      await exportSheetsToExcel({ sheets, fileName });
      toast.success('Đã xuất hồ sơ học tập.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xuất file');
    } finally {
      setBusy(null);
    }
  }

  async function exportAll() {
    setBusy('all');
    try {
      const members = await apiClient.get<CourseMembersResponse>(`/courses/${courseId}/members`);
      const students = members.enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.user);
      if (students.length === 0) {
        toast.error('Khoá học chưa có học sinh nào.');
        return;
      }

      const overviewRows: (string | number | null)[][] = [
        ['Học sinh', 'Email', 'Số bài chấm', 'Điểm TB (%)', 'Minh chứng NL', 'Tự đánh giá'],
      ];
      const gradedAll: (string | number | null)[][] = [
        ['Học sinh', 'Hoạt động', 'Loại', 'Điểm', 'Tối đa', 'Tỉ lệ %', 'Trạng thái', 'Ngày'],
      ];
      const competencyAll: (string | number | null)[][] = [
        [
          'Học sinh',
          'Danh mục',
          'Mã',
          'Chỉ báo',
          'Mức độ',
          'Loại minh chứng',
          'Hoạt động',
          'Chương / Module',
          'Ghi chú',
          'Ngày',
        ],
      ];
      const reflectionsAll: (string | number | null)[][] = [
        ['Học sinh', 'Tiêu đề', 'Nội dung', 'Ngày tạo'],
      ];

      let processed = 0;
      const toastId = toast.loading(`Đang tổng hợp 0/${students.length} học sinh…`);
      for (const s of students) {
        const studentName = (s.fullName ?? `${s.firstName} ${s.lastName}`.trim()) || s.email;
        try {
          const p = await apiClient.get<PortfolioData>(`/courses/${courseId}/portfolio/${s.id}`);
          overviewRows.push([
            studentName,
            s.email,
            p.summary.totalGraded,
            p.summary.averagePercent === null ? '' : Math.round(p.summary.averagePercent),
            p.summary.competencyCount,
            p.summary.reflectionCount,
          ]);
          for (const g of p.gradedItems) {
            gradedAll.push([
              studentName,
              g.title,
              ACTIVITY_LABEL[g.activityType] ?? g.activityType,
              g.score,
              g.maxScore,
              g.score !== null && g.maxScore && g.maxScore > 0
                ? Math.round((g.score / g.maxScore) * 100)
                : null,
              g.status,
              fmtDate(g.date),
            ]);
          }
          for (const e of p.competencyEvidence) {
            competencyAll.push([
              studentName,
              e.categoryName,
              e.indicatorCode ?? '',
              e.indicatorName,
              COMPETENCY_LEVEL_LABEL[e.level] ?? e.level,
              e.evidenceType ? (EVIDENCE_TYPE_LABEL[e.evidenceType] ?? e.evidenceType) : '',
              e.activityTitle,
              e.moduleName ?? '',
              e.note ?? '',
              fmtDate(e.gradedAt),
            ]);
          }
          for (const r of p.reflections) {
            reflectionsAll.push([studentName, r.title, r.content, fmtDate(r.createdAt)]);
          }
        } catch {
          // skip lỗi 1 HS để không phá file
        }
        processed++;
        toast.loading(`Đang tổng hợp ${processed}/${students.length} học sinh…`, {
          id: toastId,
        });
      }

      const fileName = `ho-so-toan-bo-${safeExcelFileName(courseName)}`;
      await exportSheetsToExcel({
        sheets: [
          { name: 'Tong quan', rows: overviewRows },
          { name: 'Bai lam', rows: gradedAll },
          { name: 'Nang luc', rows: competencyAll },
          { name: 'Tu danh gia', rows: reflectionsAll },
        ],
        fileName,
      });
      toast.success(`Đã xuất hồ sơ ${students.length} học sinh.`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi xuất file');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Xuất hồ sơ"
        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-50"
        disabled={busy !== null}
      >
        <Download className="h-4 w-4" />
        {busy === 'single' ? 'Đang xuất…' : busy === 'all' ? 'Đang xuất tất cả…' : 'Xuất XLSX'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Định dạng Excel (.xlsx)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportSingle} disabled={busy !== null}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Xuất hồ sơ HS này
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAll} disabled={busy !== null}>
          <Users className="mr-2 h-4 w-4" />
          Xuất toàn bộ HS trong khoá
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
