import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCourseBySlugAction } from '@/actions/courses';
import { getAssignmentAction, getMySubmissionAction } from '@/actions/assignments';
import { getRubricAction } from '@/actions/rubric';
import { listCourseNavItemsAction, type CourseNavItem } from '@/actions/modules';
import { RubricView } from '@/components/features/assignments/RubricView';
import { RichTextEditor } from '@/components/ui/editor/RichTextEditor';
import { buttonVariants } from '@/components/ui/button';
import { SubmissionForm } from '@/components/features/assignments/SubmissionForm';
import { CodeSubmitPanel } from '@/components/features/code/CodeSubmitPanel';
import { CodeAssignmentSetup } from '@/components/features/code/CodeAssignmentSetup';
import { getCodeAssignmentAction, listMyCodeSubmissionsAction } from '@/actions/code';
import { hasMinRole } from '@/lib/permissions';
import { Clock, Pencil, Users, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ClipboardList, Target, CalendarDays, FileText, Download, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

function navItemUrl(item: CourseNavItem, slug: string): string {
  if (item.type === 'LESSON'     && item.lessonId)     return `/courses/${slug}/lessons/${item.lessonId}`;
  if (item.type === 'ASSIGNMENT' && item.assignmentId) return `/courses/${slug}/assignments/${item.assignmentId}`;
  if (item.type === 'QUIZ'       && item.quizId)       return `/courses/${slug}/quizzes/${item.quizId}`;
  return `/courses/${slug}/modules`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; assignmentId: string }> }) {
  const { assignmentId } = await params;
  const a = await getAssignmentAction(assignmentId);
  return { title: a?.title ?? 'Bài tập' };
}

const TYPE_LABEL: Record<string, string> = { TEXT: 'Văn bản', FILE: 'File', BOTH: 'Văn bản + File', CODE: 'Lập trình' };
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', SUBMITTED: 'Đã nộp', LATE: 'Nộp trễ', GRADED: 'Đã chấm', RETURNED: 'Đã trả',
};
const STATUS_CLASS: Record<string, string> = {
  DRAFT:     'bg-muted text-muted-foreground border-border',
  SUBMITTED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  LATE:      'bg-amber-500/10 text-amber-500 border-amber-500/20',
  GRADED:    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  RETURNED:  'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}

export default async function AssignmentViewPage({
  params,
}: { params: Promise<{ slug: string; assignmentId: string }> }) {
  const { slug, assignmentId } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const userId = session?.user?.id;

  if (!role || !userId) redirect('/login');

  const course = await getCourseBySlugAction(slug);
  if (!course) notFound();

  const assignment = await getAssignmentAction(assignmentId);
  if (!assignment) notFound();
  if (assignment.courseId !== course.id) notFound();

  const canManage = role === 'ADMIN' || (role === 'TEACHER' && course.ownerId === userId);
  const isStaff   = hasMinRole(role, 'TA');

  if (assignment.status === 'DRAFT' && !isStaff) notFound();

  const isCodeAssignment = (assignment.type as string) === 'CODE';

  const [mySubmission, rubric, allNavItems, codeAssignment, myCodeSubs] = await Promise.all([
    role === 'STUDENT' && !isCodeAssignment ? getMySubmissionAction(assignmentId) : Promise.resolve(null),
    getRubricAction(assignmentId),
    listCourseNavItemsAction(course.id, !isStaff),
    isCodeAssignment ? getCodeAssignmentAction(assignmentId) : Promise.resolve(null),
    role === 'STUDENT' && isCodeAssignment ? listMyCodeSubmissionsAction(assignmentId) : Promise.resolve([]),
  ]);
  const currentNavIndex = allNavItems.findIndex((item) => item.assignmentId === assignmentId);
  const prevNavItem = currentNavIndex > 0 ? allNavItems[currentNavIndex - 1] ?? null : null;
  const nextNavItem = currentNavIndex < allNavItems.length - 1 ? allNavItems[currentNavIndex + 1] ?? null : null;

  const now = new Date();
  const isAvailable = !assignment.availableFrom || now >= new Date(assignment.availableFrom);
  const isPastDue   = assignment.dueDate ? now > new Date(assignment.dueDate) : false;
  const isPastLate  = assignment.lateDeadline ? now > new Date(assignment.lateDeadline) : false;
  const withinDeadline = isAvailable && !(isPastDue && assignment.latePolicy === 'NONE' && (!assignment.lateDeadline || isPastLate));

  const hasEditableSubmission = !!mySubmission && mySubmission.status !== 'GRADED';
  const canSubmit = role === 'STUDENT' && assignment.status === 'PUBLISHED' && (hasEditableSubmission || withinDeadline);

  return (
    <div className="space-y-8">
      {/* ── Page hero header ────────────────────────────────── */}
      <div className="relative -mx-6 -mt-6 overflow-hidden border-b border-border bg-card">
        {/* Tech grid */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="assignment-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#assignment-grid)" />
        </svg>

        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl" style={{ background: 'rgb(59 130 246 / 10%)' }} />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-64 rounded-full blur-3xl" style={{ background: 'oklch(0.80 0.13 210 / 0.06)' }} />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgb(59 130 246 / 60%), transparent)' }} />

        <div className="relative px-6 py-8">
          <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors duration-150 mb-4">
            <ChevronLeft className="h-3.5 w-3.5" />
            Nội dung khoá học
          </Link>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5 text-blue-500" style={{ filter: 'drop-shadow(0 0 6px #3b82f6)' }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">Bài tập</p>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
              
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tracking-wide">
                  <Target className="h-3 w-3" /> {TYPE_LABEL[assignment.type]}
                </span>
                {allNavItems.length > 1 && currentNavIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                    Mục {currentNavIndex + 1}/{allNavItems.length}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 tracking-wide">
                  <CheckCircle2 className="h-3 w-3" /> {assignment.maxScore} điểm
                </span>
                {assignment.dueDate && (
                  <span className={cn("inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide", isPastDue ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-500/20 bg-amber-500/10 text-amber-500")}>
                    <Clock className="h-3 w-3" /> Hạn nộp: {formatDate(assignment.dueDate)}
                  </span>
                )}
                {assignment.availableFrom && !isAvailable && (
                  <span className="inline-flex items-center gap-1 rounded border border-muted-foreground/20 bg-muted/30 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tracking-wide">
                    <CalendarDays className="h-3 w-3" /> Mở từ {formatDate(assignment.availableFrom)}
                  </span>
                )}
                {mySubmission && role === 'STUDENT' && (
                  <span className={cn("inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-semibold tracking-wide", STATUS_CLASS[mySubmission.status])}>
                    {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                  </span>
                )}
              </div>
            </div>

            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/courses/${slug}/assignments/${assignmentId}/submissions`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> {assignment._count.submissions} Bài nộp
                </Link>
                <Link href={`/courses/${slug}/assignments/${assignmentId}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Chỉnh sửa
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar — position in course */}
        {allNavItems.length > 1 && currentNavIndex >= 0 && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${((currentNavIndex + 1) / allNavItems.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
        {/* Code Assignment Setup — teacher/TA only */}
        {isCodeAssignment && isStaff && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary" />
            <div className="p-6">
              <CodeAssignmentSetup assignmentId={assignmentId} existing={codeAssignment} />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden transition-all duration-300 hover:border-border/80">
          <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Nội dung bài tập</h2>
          </div>
          <div className="p-6 md:p-8">
            {assignment.instructions ? (
              <div className="prose prose-invert max-w-none">
                <RichTextEditor content={assignment.instructions} editable={false} className="border-0 bg-transparent p-0" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                <FileText className="h-10 w-10 mb-3" />
                <p className="text-sm italic">Không có mô tả chi tiết.</p>
              </div>
            )}
          </div>
        </div>

        {/* Rubric — visible to all */}
        {rubric && rubric.criteria.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Tiêu chí chấm điểm (Rubric)</h2>
            </div>
            <div className="p-6">
              <RubricView rubric={rubric} />
            </div>
          </div>
        )}

        {/* CODE type: student submission via Monaco */}
        {role === 'STUDENT' && isCodeAssignment && codeAssignment && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Môi trường lập trình</h2>
            </div>
            <div className="p-0">
              <CodeSubmitPanel
                assignmentId={assignmentId}
                language={codeAssignment.language}
                starterCode={codeAssignment.starterCode ?? ''}
                initialSubs={myCodeSubs}
              />
            </div>
          </div>
        )}

        {role === 'STUDENT' && isCodeAssignment && !codeAssignment && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground font-medium">Giáo viên chưa cấu hình môi trường cho bài tập code này.</p>
          </div>
        )}

        {/* TEXT/FILE/BOTH student submission section */}
        {role === 'STUDENT' && !isCodeAssignment && (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden relative">
            {/* Glow accent */}
            <div className="absolute top-0 left-1/4 h-[1px] w-1/2 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="border-b border-border/50 bg-muted/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Khu vực nộp bài</h2>
              </div>
              {mySubmission && (
                <span className={cn('rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider', STATUS_CLASS[mySubmission.status] ?? 'border-border bg-muted text-muted-foreground')}>
                  {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
                </span>
              )}
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              {/* Submission receipt — shown for SUBMITTED / LATE */}
              {mySubmission && (mySubmission.status === 'SUBMITTED' || mySubmission.status === 'LATE') && (
                <div className={cn(
                  'flex items-center gap-3 rounded-xl border px-5 py-4 shadow-sm',
                  mySubmission.status === 'LATE'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                )}>
                  {mySubmission.status === 'LATE'
                    ? <AlertCircle className="h-5 w-5 shrink-0" />
                    : <CheckCircle2 className="h-5 w-5 shrink-0" />
                  }
                  <p className="text-sm">
                    {mySubmission.status === 'LATE' ? 'Bạn đã nộp bài trễ hạn vào lúc' : 'Bạn đã nộp bài thành công vào lúc'}{' '}
                    <span className="font-bold">{formatDate(mySubmission.submittedAt)}</span>
                  </p>
                </div>
              )}

              {/* GRADED: show score + feedback + read-only content */}
              {mySubmission?.status === 'GRADED' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4 relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                      <Target className="w-48 h-48" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary/10 pb-4">
                      <div>
                        <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Kết quả đánh giá</h3>
                        <p className="text-xs text-muted-foreground mt-1">Đã chấm lúc {formatDate(mySubmission.submittedAt)}</p>
                      </div>
                      <div className="flex items-baseline gap-1 bg-background rounded-xl px-4 py-2 border border-border shadow-sm">
                        <span className="text-3xl font-black text-foreground">{mySubmission.score}</span>
                        <span className="text-sm font-bold text-muted-foreground">/{assignment.maxScore}</span>
                      </div>
                    </div>
                    
                    {mySubmission.feedback && (
                      <div className="relative z-10">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nhận xét từ giáo viên</p>
                        <div className="prose prose-invert max-w-none text-sm">
                          <RichTextEditor content={mySubmission.feedback} editable={false} className="border-0 bg-transparent p-0" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold border-b border-border pb-2">Bài làm đã nộp</h3>
                    {mySubmission.content && (
                      <div className="rounded-xl bg-muted/30 p-4 text-sm prose prose-invert max-w-none">
                        <RichTextEditor content={mySubmission.content} editable={false} className="border-0 bg-transparent p-0" />
                      </div>
                    )}
                    {mySubmission.files.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {mySubmission.files.map((f: { id: string; name: string; url: string }) => (
                          <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-primary/40 hover:bg-muted transition-all duration-200 group">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                              <Download className="h-4 w-4" />
                            </div>
                            <span className="truncate flex-1">{f.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Editable: DRAFT, SUBMITTED, LATE, or no submission yet */}
              {canSubmit && (
                <div className="pt-2">
                  <SubmissionForm
                    assignmentId={assignmentId}
                    assignmentType={assignment.type}
                    initialContent={mySubmission?.content ?? ''}
                    isEdit={hasEditableSubmission && mySubmission?.status !== 'DRAFT'}
                  />
                </div>
              )}

              {/* Can't submit, no submission */}
              {!canSubmit && !mySubmission && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    {!isAvailable
                      ? `Bài tập chưa mở (sẽ mở từ ${formatDate(assignment.availableFrom)})`
                      : 'Đã hết hạn nộp bài.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prev / Next navigation */}
        {(prevNavItem || nextNavItem) && (
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-border">
            <div className="flex-1">
              {prevNavItem ? (
                <Link href={navItemUrl(prevNavItem, slug)} className="inline-flex items-center gap-3 hover:text-primary transition-colors max-w-full group">
                  <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài trước</p>
                    <p className="text-sm font-semibold truncate max-w-40 md:max-w-xs">{prevNavItem.title}</p>
                  </div>
                </Link>
              ) : (
                <Link href={`/courses/${slug}/modules`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Về danh sách bài học
                </Link>
              )}
            </div>
            
            <div className="flex-1 flex justify-end">
              {nextNavItem && (
                <Link href={navItemUrl(nextNavItem, slug)} className="inline-flex flex-row-reverse items-center gap-3 hover:text-primary transition-colors max-w-full text-right group">
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Bài tiếp theo</p>
                    <p className="text-sm font-semibold truncate max-w-40 md:max-w-xs">{nextNavItem.title}</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
