'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type {
  CourseMember,
  CourseTA,
  CourseCoTeacher,
  UserCandidate,
  BulkEnrollResult,
} from '@lumibach/types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type Props = {
  courseId: string;
  canManage: boolean;
  enrollments: CourseMember[];
  tas: CourseTA[];
  coTeachers: CourseCoTeacher[];
  courseOwner: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
};

function userDisplayName(u: { fullName: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
}

function Avatar({
  user,
}: {
  user: { avatar?: string | null; fullName: string | null; firstName: string; lastName: string };
}) {
  const name = userDisplayName(user);
  const initial = (name[0] ?? '?').toUpperCase();
  return user.avatar ? (
    <img src={user.avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
      {initial}
    </div>
  );
}

// ── Disambiguation picker (multiple full-name matches) ────────

function CandidatePicker({
  candidates,
  onPick,
  onCancel,
}: {
  candidates: UserCandidate[];
  onPick: (userId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs font-medium text-amber-300">
        Có nhiều người trùng tên — chọn đúng người:
      </p>
      <ul className="divide-border border-border bg-background divide-y rounded-md border">
        {candidates.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors"
            >
              <span className="text-sm">
                <span className="font-medium">
                  {c.fullName ?? `${c.firstName} ${c.lastName}`.trim()}
                </span>
                {c.username && (
                  <span className="text-muted-foreground ml-2 text-xs">@{c.username}</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{c.email}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground text-xs"
      >
        Huỷ
      </button>
    </div>
  );
}

// ── Add Student modal ─────────────────────────────────────────

function AddStudentPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [identifier, setIdentifier] = useState('');
  const [bulk, setBulk] = useState('');
  const [candidates, setCandidates] = useState<UserCandidate[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(userId?: string) {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ message: string; candidates?: UserCandidate[] }>(
          `/courses/${courseId}/enroll`,
          { identifier, userId }
        );
        if (data.candidates) {
          setCandidates(data.candidates);
        } else {
          toast.success(data.message);
          setIdentifier('');
          setCandidates(null);
          onDone();
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm học sinh');
      }
    });
  }

  function handleSingle(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    const ids = bulk
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      try {
        const data = await apiClient.post<BulkEnrollResult>(`/courses/${courseId}/enroll/bulk`, {
          identifiers: ids,
        });
        toast.success(`Đã thêm ${data.enrolled} học sinh.`);
        if (data.errors.length > 0) {
          data.errors.forEach((err) => toast.error(`${err.identifier}: ${err.reason}`));
        }
        setBulk('');
        onDone();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm học sinh');
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Thêm học sinh</CardTitle>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setMode('single')}
              className={`rounded px-2 py-1 ${mode === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              1 người
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`rounded px-2 py-1 ${mode === 'bulk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Nhiều người
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'single' ? (
          <>
            <form onSubmit={handleSingle} className="flex gap-2">
              <input
                type="text"
                placeholder="Email, username, hoặc họ tên..."
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setCandidates(null);
                }}
                required
                className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-9 flex-1 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
              />
              <Button type="submit" size="sm" disabled={pending}>
                Thêm
              </Button>
            </form>
            {candidates && (
              <CandidatePicker
                candidates={candidates}
                onPick={(id) => submit(id)}
                onCancel={() => setCandidates(null)}
              />
            )}
          </>
        ) : (
          <form onSubmit={handleBulk} className="space-y-2">
            <textarea
              placeholder={
                'Mỗi dòng 1 người (email, username hoặc họ tên):\nnguyenvana@example.com\nnguyenvanb\nLê Thị C'
              }
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={5}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Đang thêm...' : 'Thêm tất cả'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ── Add co-teacher panel ──────────────────────────────────────

function AddCoTeacherPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [candidates, setCandidates] = useState<UserCandidate[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(userId?: string) {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ message: string; candidates?: UserCandidate[] }>(
          `/courses/${courseId}/co-teachers`,
          { identifier, userId }
        );
        if (data.candidates) {
          setCandidates(data.candidates);
        } else {
          toast.success(data.message);
          setIdentifier('');
          setCandidates(null);
          onDone();
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi thêm giáo viên');
      }
    });
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Email, username hoặc họ tên (role Teacher)..."
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setCandidates(null);
          }}
          required
          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-9 flex-1 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Thêm
        </Button>
      </form>
      {candidates && (
        <CandidatePicker
          candidates={candidates}
          onPick={(id) => submit(id)}
          onCancel={() => setCandidates(null)}
        />
      )}
    </div>
  );
}

// ── Add TA panel ──────────────────────────────────────────────

function AddTAPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [candidates, setCandidates] = useState<UserCandidate[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(userId?: string) {
    startTransition(async () => {
      try {
        const data = await apiClient.post<{ message: string; candidates?: UserCandidate[] }>(
          `/courses/${courseId}/tas`,
          { identifier, userId }
        );
        if (data.candidates) {
          setCandidates(data.candidates);
        } else {
          toast.success(data.message);
          setIdentifier('');
          setCandidates(null);
          onDone();
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi gán trợ giảng');
      }
    });
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Email, username hoặc họ tên (role TA)..."
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setCandidates(null);
          }}
          required
          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-9 flex-1 rounded-md border px-3 text-sm focus:ring-1 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Gán
        </Button>
      </form>
      {candidates && (
        <CandidatePicker
          candidates={candidates}
          onPick={(id) => submit(id)}
          onCancel={() => setCandidates(null)}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function PeoplePanel({
  courseId,
  canManage,
  enrollments,
  tas,
  coTeachers,
  courseOwner,
}: Props) {
  const router = useRouter();
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddCoTeacher, setShowAddCoTeacher] = useState(false);
  const [, startTransition] = useTransition();
  const [confirmDialog, openConfirm] = useConfirmDialog();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleUnenroll(enrollmentId: string, name: string) {
    const ok = await openConfirm(`Xoá ${name} khỏi lớp?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/enrollments/${enrollmentId}`);
        toast.success('Đã xoá học sinh khỏi lớp.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá học sinh');
      }
    });
  }

  async function handleRemoveTA(taId: string, name: string) {
    const ok = await openConfirm(`Xoá ${name} khỏi danh sách trợ giảng?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/courses/${courseId}/tas/${taId}`);
        toast.success('Đã xoá trợ giảng.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá trợ giảng');
      }
    });
  }

  async function handleRemoveCoTeacher(coTeacherId: string, name: string) {
    const ok = await openConfirm(`Xoá ${name} khỏi danh sách giáo viên?`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await apiClient.delete(`/courses/${courseId}/co-teachers/${coTeacherId}`);
        toast.success('Đã xoá giáo viên khỏi khoá học.');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Lỗi xoá giáo viên');
      }
    });
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Teachers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              Giáo viên
              <Badge variant="secondary">{1 + coTeachers.length}</Badge>
            </CardTitle>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowAddCoTeacher((v) => !v)}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Thêm
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && showAddCoTeacher && (
            <AddCoTeacherPanel
              courseId={courseId}
              onDone={() => {
                setShowAddCoTeacher(false);
                refresh();
              }}
            />
          )}
          <ul className="divide-border divide-y">
            {/* Course owner — always shown, not removable */}
            <li className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3">
                <Avatar user={courseOwner} />
                <div>
                  <p className="text-sm font-medium">{userDisplayName(courseOwner)}</p>
                  <p className="text-muted-foreground text-xs">{courseOwner.email}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Chủ khoá học
              </Badge>
            </li>
            {/* Co-teachers */}
            {coTeachers.map((ct) => (
              <li key={ct.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar user={ct.user} />
                  <div>
                    <p className="text-sm font-medium">{userDisplayName(ct.user)}</p>
                    <p className="text-muted-foreground text-xs">{ct.user.email}</p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemoveCoTeacher(ct.id, userDisplayName(ct.user))}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Teaching Assistants */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              Trợ giảng
              <Badge variant="secondary">{tas.length}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && <AddTAPanel courseId={courseId} onDone={refresh} />}
          {tas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có trợ giảng.</p>
          ) : (
            <ul className="divide-border divide-y">
              {tas.map((ta) => (
                <li key={ta.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar user={ta.user} />
                    <div>
                      <p className="text-sm font-medium">{userDisplayName(ta.user)}</p>
                      <p className="text-muted-foreground text-xs">{ta.user.email}</p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleRemoveTA(ta.id, userDisplayName(ta.user))}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Students */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              Học sinh
              <Badge variant="secondary">{enrollments.length}</Badge>
            </CardTitle>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowAddStudent((v) => !v)}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Thêm
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && showAddStudent && (
            <AddStudentPanel
              courseId={courseId}
              onDone={() => {
                setShowAddStudent(false);
                refresh();
              }}
            />
          )}
          {enrollments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có học sinh nào.</p>
          ) : (
            <ul className="divide-border divide-y">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={e.user} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{userDisplayName(e.user)}</p>
                      <p className="text-muted-foreground truncate text-xs">{e.user.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground text-xs">{Math.round(e.progress)}%</span>
                    {canManage && (
                      <button
                        onClick={() => handleUnenroll(e.id, userDisplayName(e.user))}
                        className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
