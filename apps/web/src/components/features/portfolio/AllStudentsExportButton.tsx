'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
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
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function AllStudentsExportButton({ courseId, courseName }: Props) {
  const [busy, setBusy] = useState(false);

  async function exportAll() {
    setBusy(true);
    const toastId = toast.loading('Đang tải danh sách học sinh…');
    try {
      const members = await apiClient.get<CourseMembersResponse>(`/courses/${courseId}/members`);
      const students = members.enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.user);
      if (students.length === 0) {
        toast.error('Khoá học chưa có học sinh nào.', { id: toastId });
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
        } catch (err) {
          console.warn('Bỏ qua HS', studentName, err);
        }
        processed++;
        toast.loading(`Đang tổng hợp ${processed}/${students.length} học sinh…`, { id: toastId });
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
      console.error('exportAll error:', err);
      toast.error(
        err instanceof ApiError ? err.message : ((err as Error).message ?? 'Lỗi xuất file'),
        {
          id: toastId,
        }
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportAll}
      disabled={busy}
      aria-label="Xuất XLSX hồ sơ của toàn bộ học sinh"
      className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      <span>{busy ? 'Đang xuất…' : 'Xuất toàn bộ HS (XLSX)'}</span>
    </button>
  );
}
