'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportCompetencyResultsToExcel } from '@/lib/export-competency-excel';
import { Download, Plus, Save } from 'lucide-react';
import {
  LEARNING_PACE_LEVELS,
  type CompetencyCategoryLevelRow,
  type CompetencyComponentLevelRow,
  type CompetencyExportData,
  type CompetencyPeriod,
  type CompetencyPeriodGrid,
} from '@lumibach/types';

function fmtError(err: unknown, fallback = 'Có lỗi xảy ra'): string {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : fallback;
  return err.message || fallback;
}

type Props = {
  slug: string;
  courseId: string;
  canManage: boolean;
  periods: CompetencyPeriod[];
  selectedPeriodId: string | null;
  grid: CompetencyPeriodGrid | null;
};

// Nhóm componentRows/categoryRollups theo học sinh → danh mục, giữ đúng thứ
// tự học sinh/danh mục mà backend trả về (đã sort sẵn).
type CategoryBlock = {
  rollup: CompetencyCategoryLevelRow;
  components: CompetencyComponentLevelRow[];
};
type StudentBlock = {
  studentId: string;
  studentName: string;
  categories: CategoryBlock[];
};

function buildStudentBlocks(grid: CompetencyPeriodGrid): StudentBlock[] {
  const blocks = new Map<string, StudentBlock>();
  for (const rollup of grid.categoryRollups) {
    let block = blocks.get(rollup.studentId);
    if (!block) {
      block = { studentId: rollup.studentId, studentName: rollup.studentName, categories: [] };
      blocks.set(rollup.studentId, block);
    }
    block.categories.push({
      rollup,
      components: grid.componentRows.filter(
        (r) => r.studentId === rollup.studentId && r.categoryId === rollup.categoryId
      ),
    });
  }
  return [...blocks.values()];
}

export function CompetencyLevelGrid({
  slug,
  courseId,
  canManage,
  periods,
  selectedPeriodId,
  grid,
}: Props) {
  const router = useRouter();
  const [showAddPeriod, setShowAddPeriod] = useState(periods.length === 0);
  const [exportCategoryId, setExportCategoryId] = useState('');
  const [exporting, setExporting] = useState(false);

  function goToPeriod(periodId: string) {
    router.push(`/courses/${slug}/competencies/levels?period=${periodId}`);
  }

  async function handleExport() {
    if (!grid || !exportCategoryId || exporting) return;
    setExporting(true);
    try {
      const data = await apiClient.get<CompetencyExportData>(
        `/courses/${courseId}/competencies/periods/${grid.period.id}/categories/${exportCategoryId}/export`
      );
      // Phải await: hàm này nạp động ExcelJS rồi mới dựng file, không chờ thì
      // lỗi nạp/dựng rơi ra ngoài try và người dùng chỉ thấy nút hết quay chứ
      // không thấy báo lỗi nào.
      await exportCompetencyResultsToExcel(data);
    } catch (err) {
      toast.error(fmtError(err, 'Lỗi xuất Excel'));
    } finally {
      setExporting(false);
    }
  }

  const studentBlocks = grid ? buildStudentBlocks(grid) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {periods.length > 0 && (
          <SimpleSelect
            className="min-w-[200px]"
            aria-label="Kỳ đánh giá"
            value={selectedPeriodId ?? ''}
            onValueChange={goToPeriod}
            options={periods.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setShowAddPeriod((s) => !s)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Thêm kỳ đánh giá
          </Button>
        )}
        {grid && grid.categories.length > 0 && (
          <>
            <SimpleSelect
              className="min-w-[200px]"
              aria-label="Danh mục để xuất"
              value={exportCategoryId}
              onValueChange={setExportCategoryId}
              options={[
                { value: '', label: 'Chọn danh mục để xuất' },
                ...grid.categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={!exportCategoryId || exporting}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
          </>
        )}
      </div>

      {showAddPeriod && canManage && (
        <PeriodForm
          courseId={courseId}
          onDone={(period) => {
            setShowAddPeriod(false);
            router.push(`/courses/${slug}/competencies/levels?period=${period.id}`);
          }}
          onCancel={() => setShowAddPeriod(periods.length === 0)}
        />
      )}

      {!grid ? (
        <div className="border-border bg-card rounded-lg border border-dashed py-14 text-center">
          <p className="text-muted-foreground text-sm">
            Chọn hoặc tạo 1 kỳ đánh giá để nhập cấp độ năng lực.
          </p>
        </div>
      ) : studentBlocks.length === 0 ? (
        <div className="border-border bg-card rounded-lg border border-dashed py-14 text-center">
          <p className="text-muted-foreground text-sm">
            Khoá học chưa có học sinh hoặc danh mục năng lực.
          </p>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-border bg-muted/30 border-b text-left text-xs">
              <tr>
                <Th>Học sinh</Th>
                <Th>Danh mục / Thành phần</Th>
                <Th align="right">Xuất phát</Th>
                <Th align="right">Đích</Th>
                <Th align="right">Hoàn thành</Th>
                <Th align="right">Tỉ lệ %</Th>
                <Th align="right">Điểm năng lực</Th>
                <Th align="right">Tăng trưởng</Th>
                <Th>Tiến độ</Th>
                {canManage && <Th align="right">Lưu</Th>}
              </tr>
            </thead>
            <tbody>
              {studentBlocks.map((block) => (
                <StudentRows
                  key={block.studentId}
                  block={block}
                  periodId={grid.period.id}
                  canEdit={canManage}
                  onSaved={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentRows({
  block,
  periodId,
  canEdit,
  onSaved,
}: {
  block: StudentBlock;
  periodId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const totalRows = block.categories.reduce((n, c) => n + 1 + c.components.length, 0);

  return (
    <>
      {block.categories.map((cat, catIndex) => (
        <Fragment key={cat.rollup.categoryId}>
          <CategoryRollupRow
            row={cat.rollup}
            studentName={catIndex === 0 ? block.studentName : null}
            studentRowSpan={catIndex === 0 ? totalRows : undefined}
            canEdit={canEdit}
          />
          {cat.components.map((comp) => (
            <ComponentRow
              key={comp.componentId}
              row={comp}
              periodId={periodId}
              canEdit={canEdit}
              onSaved={onSaved}
            />
          ))}
        </Fragment>
      ))}
    </>
  );
}

function CategoryRollupRow({
  row,
  studentName,
  studentRowSpan,
  canEdit,
}: {
  row: CompetencyCategoryLevelRow;
  studentName: string | null;
  studentRowSpan?: number;
  canEdit: boolean;
}) {
  const pace = row.learningPace
    ? LEARNING_PACE_LEVELS.find((l) => l.value === row.learningPace)
    : null;

  return (
    <tr className="border-border/50 bg-muted/20 border-b font-medium">
      {studentName !== null ? (
        <td rowSpan={studentRowSpan} className="border-border/50 border-r px-3 py-2.5 align-top">
          {studentName}
        </td>
      ) : null}
      <Td>{row.categoryName}</Td>
      <Td align="right">{row.startLevel !== null ? row.startLevel.toFixed(2) : '—'}</Td>
      <Td align="right">{row.targetLevel !== null ? row.targetLevel.toFixed(2) : '—'}</Td>
      <Td align="right">
        {row.completedIndicators}/{row.totalIndicators}
      </Td>
      <Td align="right">
        {row.completionRate !== null ? `${Math.round(row.completionRate * 100)}%` : '—'}
      </Td>
      <Td align="right">{row.competencyScore !== null ? row.competencyScore.toFixed(2) : '—'}</Td>
      <Td align="right">{row.growthScore !== null ? row.growthScore.toFixed(2) : '—'}</Td>
      <Td>
        {pace ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: pace.color, color: pace.textColor }}
          >
            {pace.label}
          </span>
        ) : (
          '—'
        )}
      </Td>
      {canEdit && <Td align="right">{null}</Td>}
    </tr>
  );
}

function ComponentRow({
  row,
  periodId,
  canEdit,
  onSaved,
}: {
  row: CompetencyComponentLevelRow;
  periodId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [startLevel, setStartLevel] = useState(
    row.startLevel !== null ? String(row.startLevel) : ''
  );
  const [targetLevel, setTargetLevel] = useState(
    row.targetLevel !== null ? String(row.targetLevel) : ''
  );
  const [saving, setSaving] = useState(false);

  const startNum = Number(startLevel);
  const targetNum = Number(targetLevel);
  const valid =
    startLevel !== '' &&
    targetLevel !== '' &&
    Number.isInteger(startNum) &&
    Number.isInteger(targetNum) &&
    startNum >= 1 &&
    startNum <= 12 &&
    targetNum >= 1 &&
    targetNum <= 12;
  const changed = valid && (startNum !== row.startLevel || targetNum !== row.targetLevel);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await apiClient.put('/competencies/level-targets', {
        periodId,
        componentId: row.componentId,
        studentId: row.studentId,
        startLevel: startNum,
        targetLevel: targetNum,
      });
      toast.success('Đã lưu cấp độ năng lực.');
      onSaved();
    } catch (err) {
      toast.error(fmtError(err, 'Lỗi lưu cấp độ năng lực'));
    } finally {
      setSaving(false);
    }
  }

  const pace = row.learningPace
    ? LEARNING_PACE_LEVELS.find((l) => l.value === row.learningPace)
    : null;

  return (
    <tr className="border-border/50 hover:bg-muted/20 border-b">
      <Td>
        <span className="text-muted-foreground pl-4 text-xs">↳ {row.componentName}</span>
      </Td>
      <Td align="right">
        {canEdit ? (
          <Input
            type="number"
            min={1}
            max={12}
            value={startLevel}
            onChange={(event) => setStartLevel(event.target.value)}
            className="h-8 w-16 text-right"
          />
        ) : (
          (row.startLevel ?? '—')
        )}
      </Td>
      <Td align="right">
        {canEdit ? (
          <Input
            type="number"
            min={1}
            max={12}
            value={targetLevel}
            onChange={(event) => setTargetLevel(event.target.value)}
            className="h-8 w-16 text-right"
          />
        ) : (
          (row.targetLevel ?? '—')
        )}
      </Td>
      <Td align="right">
        {row.completedIndicators}/{row.totalIndicators}
      </Td>
      <Td align="right">
        {row.completionRate !== null ? `${Math.round(row.completionRate * 100)}%` : '—'}
      </Td>
      <Td align="right">{row.competencyScore !== null ? row.competencyScore.toFixed(2) : '—'}</Td>
      <Td align="right">{row.growthScore !== null ? row.growthScore.toFixed(2) : '—'}</Td>
      <Td>
        {pace ? (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: pace.color, color: pace.textColor }}
          >
            {pace.label}
          </span>
        ) : (
          '—'
        )}
      </Td>
      {canEdit && (
        <Td align="right">
          <Button size="sm" variant="ghost" disabled={!changed || saving} onClick={save}>
            <Save className="h-3.5 w-3.5" />
          </Button>
        </Td>
      )}
    </tr>
  );
}

function PeriodForm({
  courseId,
  onDone,
  onCancel,
}: {
  courseId: string;
  onDone: (period: CompetencyPeriod) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Nhập tên kỳ đánh giá.');
      return;
    }

    setSaving(true);
    try {
      const period = await apiClient.post<CompetencyPeriod>(
        `/courses/${courseId}/competencies/periods`,
        {
          name: cleanName,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }
      );
      toast.success('Đã tạo kỳ đánh giá.');
      onDone(period);
    } catch (err) {
      toast.error(fmtError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-border bg-card space-y-3 rounded-lg border p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          autoFocus
          placeholder="Tên kỳ (VD: Học kỳ 1)"
          value={name}
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          aria-label="Từ ngày"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          aria-label="Đến ngày"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Tạo kỳ'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`text-muted-foreground px-3 py-2.5 font-semibold whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
