'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2, Pencil, Save, Search, Target, Users } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  COMPETENCY_LEVELS,
  EVIDENCE_CATEGORIES,
  type ActivityType,
  type ActivityCompetencyState,
  type CompetencyAssessmentItem,
  type CompetencyCategoryItem,
  type CompetencyIndicatorItem,
  type CourseCompetencyCatalog,
  type CourseMember,
  type CourseMembersResponse,
} from '@lumibach/types';

type Props = {
  courseId: string;
  courseSlug: string;
  activityType: ActivityType;
  activityId: string;
  canManage: boolean;
  activityTitle?: string;
};

type RowState = {
  level: string;
  evidenceType: string;
  note: string;
};

function fmtError(err: unknown, fallback = 'Có lỗi xảy ra'): string {
  if (!(err instanceof ApiError)) return err instanceof Error ? err.message : fallback;
  if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
    const parts = (err.details as { path?: string; message?: string }[])
      .map((detail) =>
        detail.path ? `${detail.path}: ${detail.message ?? ''}` : (detail.message ?? '')
      )
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  return err.message || fallback;
}

function displayName(student: CourseMember) {
  return (
    (student.user.fullName ??
      `${student.user.firstName ?? ''} ${student.user.lastName ?? ''}`.trim()) ||
    student.user.email
  );
}

export function ActivityCompetencyWorkspace({
  courseId,
  courseSlug,
  activityType,
  activityId,
  canManage,
  activityTitle,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CompetencyCategoryItem[]>([]);
  const [assigned, setAssigned] = useState<CompetencyIndicatorItem[]>([]);
  const [assessments, setAssessments] = useState<CompetencyAssessmentItem[]>([]);
  const [students, setStudents] = useState<CourseMember[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;

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
        if (!alive) return;
        const activeStudents = members.enrollments
          .filter((enrollment) => enrollment.status === 'ACTIVE')
          .sort((a, b) => displayName(a).localeCompare(displayName(b), 'vi'));
        setCatalog(cat.categories);
        setAssigned(state.indicators);
        setAssessments(state.assessments);
        setStudents(activeStudents);
        setSelectedStudentId((current) => current || activeStudents[0]?.userId || '');
      } catch (err) {
        toast.error(fmtError(err, 'Lỗi tải dữ liệu năng lực'));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [activityId, activityType, courseId]);

  const gradedStudentIds = useMemo(
    () => new Set(assessments.map((item) => item.studentId)),
    [assessments]
  );

  const filteredStudents = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return students;
    return students.filter((student) => {
      const name = displayName(student).toLowerCase();
      return name.includes(text) || student.user.email.toLowerCase().includes(text);
    });
  }, [query, students]);

  const selectedStudent = students.find((student) => student.userId === selectedStudentId) ?? null;

  if (loading) {
    return (
      <div className="border-border bg-card flex min-h-[360px] items-center justify-center rounded-lg border">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải dữ liệu chấm năng lực...
        </div>
      </div>
    );
  }

  const gradedRows = assessments.length;
  const totalRows = assigned.length * students.length;

  return (
    <div className="space-y-5">
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <div className="relative border-b px-5 py-5">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 border-primary/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border">
                <Target className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-primary text-[11px] font-bold tracking-[0.2em] uppercase">
                  Chấm năng lực
                </p>
                <h1 className="mt-1 text-2xl font-bold">{activityTitle ?? 'Hoạt động học tập'}</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Gán chỉ báo cho hoạt động và ghi nhận mức độ thành thạo theo từng học sinh.
                </p>
              </div>
            </div>
            <Link
              href={`/courses/${courseSlug}/competencies`}
              className="text-muted-foreground hover:text-primary text-sm font-medium"
            >
              Kho năng lực
            </Link>
          </div>
        </div>

        <div className="bg-border grid grid-cols-2 gap-px md:grid-cols-4">
          <Metric label="Chỉ báo đã gán" value={String(assigned.length)} />
          <Metric label="Học sinh" value={String(students.length)} />
          <Metric label="Đã chấm" value={`${gradedStudentIds.size}/${students.length}`} />
          <Metric
            label="Dòng ghi nhận"
            value={totalRows > 0 ? `${gradedRows}/${totalRows}` : '0'}
          />
        </div>
      </div>

      <IndicatorAssignment
        courseSlug={courseSlug}
        activityType={activityType}
        activityId={activityId}
        canManage={canManage}
        catalog={catalog}
        assigned={assigned}
        onSaved={(next) => setAssigned(next)}
      />

      {assigned.length === 0 ? (
        <div className="border-border bg-card rounded-lg border border-dashed px-5 py-10 text-center">
          <Target className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
          <p className="font-semibold">Chưa có chỉ báo để chấm</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Hãy gán ít nhất một chỉ báo năng lực cho hoạt động này trước khi chấm học sinh.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="text-primary h-4 w-4" />
                <p className="text-sm font-semibold">Học sinh</p>
              </div>
              <div className="relative mt-3">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm học sinh"
                  className="h-9 pl-9"
                />
              </div>
            </div>
            <div className="max-h-[620px] divide-y overflow-y-auto">
              {filteredStudents.map((student) => {
                const active = selectedStudentId === student.userId;
                const graded = gradedStudentIds.has(student.userId);
                return (
                  <button
                    key={student.userId}
                    type="button"
                    onClick={() => setSelectedStudentId(student.userId)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/40'
                    )}
                  >
                    {graded ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {displayName(student)}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {student.user.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <GradingBoard
            activityType={activityType}
            activityId={activityId}
            student={selectedStudent}
            assigned={assigned}
            assessments={assessments}
            onAssessmentsChange={setAssessments}
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function IndicatorAssignment({
  courseSlug,
  activityType,
  activityId,
  canManage,
  catalog,
  assigned,
  onSaved,
}: {
  courseSlug: string;
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

  const indicators = catalog.flatMap((category) => category.indicators);
  const hasCatalog = indicators.length > 0;

  function startEdit() {
    setSelected(new Set(assigned.map((indicator) => indicator.id)));
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
        onSaved(indicators.filter((indicator) => selected.has(indicator.id)));
        setEditing(false);
        toast.success('Đã cập nhật chỉ báo năng lực cho hoạt động.');
      } catch (err) {
        toast.error(fmtError(err, 'Lỗi lưu chỉ báo'));
      }
    });
  }

  return (
    <section className="border-border bg-card rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Chỉ báo của hoạt động</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Chọn các chỉ báo sẽ được dùng để chấm năng lực học sinh.
          </p>
        </div>
        {canManage && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {assigned.length > 0 ? 'Chỉnh sửa chỉ báo' : 'Gán chỉ báo'}
          </Button>
        )}
      </div>

      <div className="px-5 py-4">
        {!editing ? (
          assigned.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chưa gán chỉ báo nào.{' '}
              <Link href={`/courses/${courseSlug}/competencies`} className="text-primary underline">
                Tạo hoặc kiểm tra kho năng lực
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assigned.map((indicator) => (
                <Badge key={indicator.id} variant="secondary" className="max-w-full text-xs">
                  <span className="truncate">
                    {indicator.code ? `${indicator.code} · ` : ''}
                    {indicator.name}
                  </span>
                </Badge>
              ))}
            </div>
          )
        ) : !hasCatalog ? (
          <p className="text-muted-foreground text-sm">
            Khoá học chưa có chỉ báo năng lực.{' '}
            <Link href={`/courses/${courseSlug}/competencies`} className="text-primary underline">
              Tạo danh mục và chỉ báo
            </Link>{' '}
            trước.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {catalog
                .filter((category) => category.indicators.length > 0)
                .map((category) => (
                  <div key={category.id} className="border-border rounded-lg border p-3">
                    <p className="text-xs font-bold tracking-wide uppercase">{category.name}</p>
                    <div className="mt-2 space-y-1">
                      {category.indicators.map((indicator) => (
                        <label
                          key={indicator.id}
                          className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(indicator.id)}
                            onChange={() => toggleIndicator(indicator.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            {indicator.code && (
                              <span className="text-primary mr-1.5 font-mono text-xs">
                                {indicator.code}
                              </span>
                            )}
                            {indicator.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {pending ? 'Đang lưu...' : `Lưu ${selected.size} chỉ báo`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function GradingBoard({
  activityType,
  activityId,
  student,
  assigned,
  assessments,
  onAssessmentsChange,
}: {
  activityType: ActivityType;
  activityId: string;
  student: CourseMember | null;
  assigned: CompetencyIndicatorItem[];
  assessments: CompetencyAssessmentItem[];
  onAssessmentsChange: (next: CompetencyAssessmentItem[]) => void;
}) {
  const [grades, setGrades] = useState<Record<string, RowState>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!student) {
      setGrades({});
      return;
    }
    const next: Record<string, RowState> = {};
    for (const indicator of assigned) {
      const assessment = assessments.find(
        (item) => item.studentId === student.userId && item.indicatorId === indicator.id
      );
      next[indicator.id] = {
        level: assessment?.level ?? '',
        evidenceType: assessment?.evidenceType ?? '',
        note: assessment?.note ?? '',
      };
    }
    setGrades(next);
  }, [assigned, assessments, student]);

  function setRow(indicatorId: string, patch: Partial<RowState>) {
    setGrades((prev) => ({
      ...prev,
      [indicatorId]: {
        ...(prev[indicatorId] ?? { level: '', evidenceType: '', note: '' }),
        ...patch,
      },
    }));
  }

  async function saveRow(indicatorId: string, override?: Partial<RowState>) {
    if (!student) return;
    const current = grades[indicatorId] ?? { level: '', evidenceType: '', note: '' };
    const merged = { ...current, ...override };
    if (!merged.level) return;

    setSavingIds((prev) => new Set(prev).add(indicatorId));
    try {
      const saved = await apiClient.put<CompetencyAssessmentItem>('/competencies/assessment', {
        activityType,
        activityId,
        indicatorId,
        studentId: student.userId,
        level: merged.level,
        evidenceType: merged.evidenceType || null,
        note: merged.note || null,
      });
      const filtered = assessments.filter(
        (item) => !(item.studentId === student.userId && item.indicatorId === indicatorId)
      );
      onAssessmentsChange([...filtered, saved]);
      toast.success('Đã lưu đánh giá', { id: `save-${indicatorId}`, duration: 1200 });
    } catch (err) {
      toast.error(fmtError(err, 'Lỗi lưu đánh giá'));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(indicatorId);
        return next;
      });
    }
  }

  if (!student) {
    return (
      <section className="border-border bg-card rounded-lg border border-dashed px-5 py-10 text-center">
        <p className="text-muted-foreground text-sm">Chọn một học sinh để bắt đầu chấm.</p>
      </section>
    );
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{displayName(student)}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{student.user.email}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {assigned.length} chỉ báo
        </Badge>
      </div>

      <div className="divide-y">
        {assigned.map((indicator) => {
          const row = grades[indicator.id] ?? { level: '', evidenceType: '', note: '' };
          const saving = savingIds.has(indicator.id);
          return (
            <div key={indicator.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-snug font-semibold">
                    {indicator.code && (
                      <span className="text-primary mr-2 font-mono text-xs">{indicator.code}</span>
                    )}
                    {indicator.name}
                  </p>
                  {indicator.description && (
                    <p className="text-muted-foreground mt-1 text-xs">{indicator.description}</p>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  {saving ? 'Đang lưu...' : row.level ? 'Đã ghi nhận' : 'Chưa chấm'}
                </span>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(220px,280px)_1fr]">
                <label className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">Loại minh chứng</span>
                  <select
                    value={row.evidenceType}
                    onChange={(event) => {
                      setRow(indicator.id, { evidenceType: event.target.value });
                      void saveRow(indicator.id, { evidenceType: event.target.value });
                    }}
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Chọn loại minh chứng</option>
                    {EVIDENCE_CATEGORIES.map((category) => (
                      <optgroup key={category.key} label={category.label}>
                        {category.types.map((type) => (
                          <option key={type.key} value={type.key}>
                            {type.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    Mức độ thành thạo
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COMPETENCY_LEVELS.map((level) => {
                      const active = row.level === level.value;
                      return (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => {
                            setRow(indicator.id, { level: level.value });
                            void saveRow(indicator.id, { level: level.value });
                          }}
                          disabled={saving}
                          className={cn(
                            'h-9 rounded-md border px-3 text-xs font-semibold transition-all disabled:opacity-60',
                            active ? 'shadow-sm' : 'bg-background hover:bg-muted/40'
                          )}
                          style={
                            active
                              ? {
                                  backgroundColor: level.color,
                                  borderColor: level.color,
                                  color: level.textColor,
                                }
                              : { borderColor: level.color, color: level.color }
                          }
                        >
                          {level.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Input
                value={row.note}
                onChange={(event) => setRow(indicator.id, { note: event.target.value })}
                onBlur={() => void saveRow(indicator.id)}
                placeholder="Ghi chú nội bộ cho đánh giá này"
                className="h-9"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
