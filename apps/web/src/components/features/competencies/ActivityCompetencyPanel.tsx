'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Target, ChevronDown, ChevronRight, Pencil, Save } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  EVIDENCE_CATEGORIES,
  COMPETENCY_LEVELS,
  type ActivityType,
  type CompetencyCategoryItem,
  type CompetencyIndicatorItem,
  type CompetencyAssessmentItem,
  type CourseCompetencyCatalog,
  type ActivityCompetencyState,
  type CourseMembersResponse,
  type CourseMember,
} from '@lumibach/types';

type Props = {
  courseId: string;
  activityType: ActivityType;
  activityId: string;
  canManage: boolean;
};

type RowState = { level: string; evidenceType: string; note: string };

export function ActivityCompetencyPanel({ courseId, activityType, activityId, canManage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [catalog, setCatalog] = useState<CompetencyCategoryItem[]>([]);
  const [assigned, setAssigned] = useState<CompetencyIndicatorItem[]>([]);
  const [assessments, setAssessments] = useState<CompetencyAssessmentItem[]>([]);
  const [students, setStudents] = useState<CourseMember[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [cat, state, members] = await Promise.all([
        apiClient.get<CourseCompetencyCatalog>(`/courses/${courseId}/competencies`),
        apiClient.get<ActivityCompetencyState>('/competencies/activity', {
          query: { activityType, activityId },
        }),
        apiClient.get<CourseMembersResponse>(`/courses/${courseId}/members`),
      ]);
      setCatalog(cat.categories);
      setAssigned(state.indicators);
      setAssessments(state.assessments);
      setStudents(
        members.enrollments
          .filter((e) => e.status === 'ACTIVE')
          .sort((a, b) => (a.user.fullName ?? '').localeCompare(b.user.fullName ?? '', 'vi'))
      );
      setLoaded(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu năng lực');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded && !loading) void load();
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <button
        onClick={toggle}
        className="hover:bg-muted/30 flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Target className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">Đánh giá năng lực</span>
          {loaded && assigned.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {assigned.length} chỉ báo
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="border-border border-t px-5 py-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Đang tải…</p>
          ) : !loaded ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <div className="space-y-5">
              <IndicatorAssignment
                courseId={courseId}
                activityType={activityType}
                activityId={activityId}
                canManage={canManage}
                catalog={catalog}
                assigned={assigned}
                onSaved={(next) => setAssigned(next)}
              />

              <GradingSection
                activityType={activityType}
                activityId={activityId}
                assigned={assigned}
                students={students}
                assessments={assessments}
                onAssessmentsChange={setAssessments}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Indicator assignment ───────────────────────────────────────

function IndicatorAssignment({
  courseId,
  activityType,
  activityId,
  canManage,
  catalog,
  assigned,
  onSaved,
}: {
  courseId: string;
  activityType: ActivityType;
  activityId: string;
  canManage: boolean;
  catalog: CompetencyCategoryItem[];
  assigned: CompetencyIndicatorItem[];
  onSaved: (next: CompetencyIndicatorItem[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const hasCatalog = catalog.some((c) => c.indicators.length > 0);

  function startEdit() {
    setSelected(new Set(assigned.map((i) => i.id)));
    setEditing(true);
  }

  function toggleIndicator(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const indicatorIds = [...selected];
    startTransition(async () => {
      try {
        await apiClient.put('/competencies/activity', { activityType, activityId, indicatorIds });
        const nextAssigned = catalog.flatMap((c) => c.indicators).filter((i) => selected.has(i.id));
        onSaved(nextAssigned);
        setEditing(false);
        toast.success('Đã cập nhật chỉ báo cho hoạt động.');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu chỉ báo');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Chỉ báo năng lực của hoạt động
        </p>
        {canManage && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {assigned.length > 0 ? 'Chỉnh sửa' : 'Gán chỉ báo'}
          </Button>
        )}
      </div>

      {!editing ? (
        assigned.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Chưa gán chỉ báo nào.{' '}
            {canManage && (
              <>
                Nhấn “Gán chỉ báo” để chọn từ{' '}
                <a href={`/courses/${courseId}/competencies`} className="text-primary underline">
                  danh mục năng lực
                </a>
                .
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((i) => (
              <Badge key={i.id} variant="secondary" className="text-xs">
                {i.code ? `${i.code} · ` : ''}
                {i.name}
              </Badge>
            ))}
          </div>
        )
      ) : !hasCatalog ? (
        <p className="text-muted-foreground text-sm">
          Khoá học chưa có chỉ báo năng lực.{' '}
          <a href={`/courses/${courseId}/competencies`} className="text-primary underline">
            Tạo danh mục &amp; chỉ báo
          </a>{' '}
          trước.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="border-border max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
            {catalog
              .filter((c) => c.indicators.length > 0)
              .map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <p className="text-xs font-semibold">{cat.name}</p>
                  <div className="space-y-1">
                    {cat.indicators.map((ind) => (
                      <label
                        key={ind.id}
                        className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(ind.id)}
                          onChange={() => toggleIndicator(ind.id)}
                          className="mt-0.5"
                        />
                        <span>
                          {ind.code && (
                            <span className="text-muted-foreground mr-1.5 font-mono text-xs">
                              {ind.code}
                            </span>
                          )}
                          {ind.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? 'Đang lưu…' : `Lưu (${selected.size})`}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Huỷ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grading per student ────────────────────────────────────────

function GradingSection({
  activityType,
  activityId,
  assigned,
  students,
  assessments,
  onAssessmentsChange,
}: {
  activityType: ActivityType;
  activityId: string;
  assigned: CompetencyIndicatorItem[];
  students: CourseMember[];
  assessments: CompetencyAssessmentItem[];
  onAssessmentsChange: (next: CompetencyAssessmentItem[]) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [grades, setGrades] = useState<Record<string, RowState>>({});
  const [pending, startTransition] = useTransition();

  function selectStudent(id: string) {
    setStudentId(id);
    const init: Record<string, RowState> = {};
    for (const ind of assigned) {
      const a = assessments.find((x) => x.studentId === id && x.indicatorId === ind.id);
      init[ind.id] = {
        level: a?.level ?? '',
        evidenceType: a?.evidenceType ?? '',
        note: a?.note ?? '',
      };
    }
    setGrades(init);
  }

  function setRow(indicatorId: string, patch: Partial<RowState>) {
    setGrades((prev) => ({ ...prev, [indicatorId]: { ...prev[indicatorId]!, ...patch } }));
  }

  function saveAll() {
    const rows = assigned.filter((ind) => grades[ind.id]?.level);
    if (rows.length === 0) {
      toast.error('Chọn mức độ cho ít nhất một chỉ báo.');
      return;
    }
    startTransition(async () => {
      try {
        const saved = await Promise.all(
          rows.map((ind) =>
            apiClient.put<CompetencyAssessmentItem>('/competencies/assessment', {
              activityType,
              activityId,
              indicatorId: ind.id,
              studentId,
              level: grades[ind.id]!.level,
              evidenceType: grades[ind.id]!.evidenceType || null,
              note: grades[ind.id]!.note || null,
            })
          )
        );
        // Gộp kết quả vào danh sách assessments.
        const bySaved = new Map(saved.map((s) => [`${s.studentId}:${s.indicatorId}`, s]));
        const next = assessments.filter((a) => !bySaved.has(`${a.studentId}:${a.indicatorId}`));
        onAssessmentsChange([...next, ...saved]);
        toast.success(`Đã lưu ${saved.length} đánh giá năng lực.`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi lưu đánh giá');
      }
    });
  }

  // Số học sinh đã được chấm (có ≥1 assessment).
  const gradedStudentIds = new Set(assessments.map((a) => a.studentId));

  if (assigned.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Chấm năng lực học sinh
        </p>
        <p className="text-muted-foreground text-sm">
          Hãy gán chỉ báo cho hoạt động trước khi chấm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Chấm năng lực học sinh
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={studentId}
          onChange={(e) => selectStudent(e.target.value)}
          className="border-input bg-background focus:ring-ring h-9 min-w-64 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
        >
          <option value="">— Chọn học sinh để chấm —</option>
          {students.map((s) => (
            <option key={s.userId} value={s.userId}>
              {gradedStudentIds.has(s.userId) ? '✓ ' : ''}
              {s.user.fullName ?? s.user.email}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-xs">
          {gradedStudentIds.size}/{students.length} học sinh đã chấm
        </span>
      </div>

      {studentId && (
        <div className="space-y-3">
          {assigned.map((ind) => {
            const row = grades[ind.id] ?? { level: '', evidenceType: '', note: '' };
            return (
              <div key={ind.id} className="border-border space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {ind.code && (
                    <span className="text-muted-foreground mr-1.5 font-mono text-xs">
                      {ind.code}
                    </span>
                  )}
                  {ind.name}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">Mức độ thành thạo</label>
                    <select
                      value={row.level}
                      onChange={(e) => setRow(ind.id, { level: e.target.value })}
                      className={cn(
                        'border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-2 text-sm focus:ring-1 focus:outline-none',
                        !row.level && 'text-muted-foreground'
                      )}
                    >
                      <option value="">— Chọn mức độ —</option>
                      {COMPETENCY_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-xs">Loại minh chứng</label>
                    <select
                      value={row.evidenceType}
                      onChange={(e) => setRow(ind.id, { evidenceType: e.target.value })}
                      className={cn(
                        'border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-2 text-sm focus:ring-1 focus:outline-none',
                        !row.evidenceType && 'text-muted-foreground'
                      )}
                    >
                      <option value="">— Chọn loại minh chứng —</option>
                      {EVIDENCE_CATEGORIES.map((cat) => (
                        <optgroup key={cat.key} label={cat.label}>
                          {cat.types.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  placeholder="Ghi chú (tuỳ chọn)"
                  value={row.note}
                  onChange={(e) => setRow(ind.id, { note: e.target.value })}
                />
              </div>
            );
          })}

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" onClick={saveAll} disabled={pending}>
              <Save className="mr-1.5 h-4 w-4" />
              {pending ? 'Đang lưu…' : 'Lưu đánh giá'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
