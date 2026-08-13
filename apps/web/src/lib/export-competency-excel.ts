// Xuất file Excel "Tổng hợp kết quả" + 1 sheet/học sinh, mô phỏng cấu trúc
// file mẫu H.A.S (26-27 MIT S3): 1 sheet tổng hợp + N sheet học sinh, mỗi
// sheet học sinh liệt kê từng minh chứng riêng lẻ kèm rubric của đúng hoạt
// động đã chấm. Dùng lại thư viện `xlsx` (SheetJS) đã có sẵn trong dự án —
// không thêm dependency mới. SheetJS bản community hỗ trợ merge ô nhưng
// không hỗ trợ tô màu/viền, nên chỉ khớp về nội dung + bố cục + merge ô.
import { utils, writeFile } from 'xlsx';
import {
  COMPETENCY_LEVEL_LABEL,
  LEARNING_PACE_LABEL,
  type CompetencyExportData,
  type CompetencyExportStudent,
} from '@lumibach/types';

type Cell = string | number | null;
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

function safeSheetName(value: string): string {
  return (
    (value || 'Sheet1')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet1'
  );
}

function fmtLevel(value: number | null): Cell {
  return value === null ? '' : Number(value.toFixed(2));
}

function fmtPercent(value: number | null): Cell {
  return value === null ? '' : `${Math.round(value * 100)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}

function buildSummarySheet(data: CompetencyExportData): { rows: Cell[][]; merges: Merge[] } {
  const rows: Cell[][] = [];
  const merges: Merge[] = [];

  rows.push([`TỔNG HỢP KẾT QUẢ NĂNG LỰC HỌC SINH / SUMMARY OF STUDENT COMPETENCY RESULTS`]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } });
  rows.push([
    `Năng lực / Competency: ${data.category.name}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Kỳ đánh giá / Period: ${data.period.name}`,
  ]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
  merges.push({ s: { r: 1, c: 10 }, e: { r: 1, c: 13 } });
  rows.push([]);

  const headerRow = rows.length;
  rows.push([
    'STT',
    'Mã học sinh\nStudent Code',
    'Họ và tên\nFull Name',
    'Cấp độ hiện tại\nPresent level',
    'Cấp độ đích\nTarget level',
    'Tỷ lệ % hoàn thành\nProgress',
    'Điểm năng lực\nPerformance level',
    'Mức tăng trưởng\nGrowth',
    'Tiến độ học tập\nOn track',
    'Diễn giải\nExplanation',
    'Đánh giá tổng thể\nOverall',
    'Điểm mạnh\nStrengths',
    'Điểm cần cải thiện\nAreas for improvement',
    'Ghi chú\nNote',
  ]);

  data.students.forEach((s, index) => {
    rows.push([
      index + 1,
      s.studentCode,
      s.fullName,
      fmtLevel(s.categoryStart),
      fmtLevel(s.categoryTarget),
      fmtPercent(s.categoryRate),
      fmtLevel(s.categoryScore),
      fmtLevel(s.categoryGrowth),
      s.learningPace ? LEARNING_PACE_LABEL[s.learningPace] : '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  void headerRow;
  return { rows, merges };
}

function buildStudentSheet(
  category: CompetencyExportData['category'],
  student: CompetencyExportStudent
): { rows: Cell[][]; merges: Merge[] } {
  const rows: Cell[][] = [];
  const merges: Merge[] = [];

  rows.push([`Mã học sinh: ${student.studentCode}`, student.fullName]);
  merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } });
  rows.push([`NĂNG LỰC: ${category.name.toUpperCase()}`]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
  rows.push([
    'Cấp độ hiện tại (danh mục)',
    fmtLevel(student.categoryStart),
    'Cấp độ đích (danh mục)',
    fmtLevel(student.categoryTarget),
    'Điểm năng lực (danh mục)',
    fmtLevel(student.categoryScore),
    'Tăng trưởng',
    fmtLevel(student.categoryGrowth),
    'Tiến độ',
    student.learningPace ? LEARNING_PACE_LABEL[student.learningPace] : '',
  ]);
  rows.push([]);

  for (const comp of student.components) {
    const compRow = rows.length;
    rows.push([
      `${comp.code ? comp.code + ' — ' : ''}${comp.name}`,
      '',
      'Cấp độ hiện tại',
      fmtLevel(comp.startLevel),
      'Cấp độ đích',
      fmtLevel(comp.targetLevel),
      'Điểm thành phần',
      fmtLevel(comp.score),
      'Tăng trưởng',
      fmtLevel(comp.growth),
      'Hoàn thành',
      `${comp.completedCount}/${comp.totalCount}`,
    ]);
    merges.push({ s: { r: compRow, c: 0 }, e: { r: compRow, c: 1 } });

    rows.push([
      'Mã chỉ báo',
      'Chỉ báo',
      'Kết luận',
      'Hoạt động',
      'Mức độ',
      'Ngày chấm',
      'Tiêu chí (rubric) ở mức đã đạt',
    ]);

    for (const ind of comp.indicators) {
      if (ind.evidences.length === 0) {
        rows.push([
          ind.code ?? '',
          ind.name,
          ind.completed ? 'Hoàn thành' : 'Chưa hoàn thành',
          '',
          '',
          '',
          '',
        ]);
        continue;
      }
      ind.evidences.forEach((ev, i) => {
        const rubricKey = (
          {
            NO_EVIDENCE: 'noEvidence',
            BEGINNING: 'beginning',
            APPROACHING: 'approaching',
            PROFICIENT: 'proficient',
            ADVANCED: 'advanced',
          } as const
        )[ev.level];
        rows.push([
          i === 0 ? (ind.code ?? '') : '',
          i === 0 ? ind.name : '',
          i === 0 ? (ind.completed ? 'Hoàn thành' : 'Chưa hoàn thành') : '',
          ev.activityTitle,
          COMPETENCY_LEVEL_LABEL[ev.level],
          fmtDate(ev.gradedAt),
          ev.rubric[rubricKey] ?? '',
        ]);
      });
    }
    rows.push([]);
  }

  return { rows, merges };
}

export function exportCompetencyResultsToExcel(data: CompetencyExportData) {
  const workbook = utils.book_new();

  const summary = buildSummarySheet(data);
  const summaryWs = utils.aoa_to_sheet(summary.rows);
  summaryWs['!merges'] = summary.merges;
  summaryWs['!cols'] = Array.from({ length: 14 }, () => ({ wch: 20 }));
  utils.book_append_sheet(workbook, summaryWs, 'Tổng hợp kết quả');

  const usedNames = new Set<string>(['Tổng hợp kết quả']);
  for (const student of data.students) {
    const sheet = buildStudentSheet(data.category, student);
    const ws = utils.aoa_to_sheet(sheet.rows);
    ws['!merges'] = sheet.merges;
    ws['!cols'] = Array.from({ length: 12 }, () => ({ wch: 22 }));

    let candidate = safeSheetName(student.studentCode || student.fullName);
    let i = 2;
    while (usedNames.has(candidate)) {
      candidate = safeSheetName(`${student.studentCode} ${i++}`);
    }
    usedNames.add(candidate);
    utils.book_append_sheet(workbook, ws, candidate);
  }

  const fileName = `tong-hop-nang-luc-${safeSheetName(data.category.name).toLowerCase().replace(/\s+/g, '-')}.xlsx`;
  writeFile(workbook, fileName);
}
