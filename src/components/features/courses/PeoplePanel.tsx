'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPlus, Trash2, RefreshCw } from 'lucide-react';
import {
  enrollUserAction,
  bulkEnrollAction,
  unenrollAction,
  assignTAAction,
  removeTAAction,
  addCoTeacherAction,
  removeCoTeacherAction,
  type CourseMember,
  type CourseTA,
  type CourseCoTeacher,
} from '@/actions/enrollments';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

type Props = {
  courseId: string;
  canManage: boolean;
  enrollments: CourseMember[];
  tas: CourseTA[];
  coTeachers: CourseCoTeacher[];
  courseOwner: { id: string; fullName: string | null; firstName: string; lastName: string; email: string; avatar: string | null };
};

function userDisplayName(u: { fullName: string | null; firstName: string; lastName: string }) {
  return u.fullName ?? `${u.firstName} ${u.lastName}`.trim();
}

function Avatar({ user }: { user: { avatar: string | null; fullName: string | null; firstName: string; lastName: string } }) {
  const name = userDisplayName(user);
  const initial = (name[0] ?? '?').toUpperCase();
  return user.avatar ? (
    <img src={user.avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {initial}
    </div>
  );
}

// ── Add Student modal ─────────────────────────────────────────

function AddStudentPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [email, setEmail] = useState('');
  const [bulk, setBulk] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSingle(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await enrollUserAction(courseId, email);
      if (res.success) { toast.success(res.message); setEmail(''); onDone(); }
      else toast.error(res.error);
    });
  }

  function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    const emails = bulk.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    startTransition(async () => {
      const res = await bulkEnrollAction(courseId, emails);
      if (res.success) {
        toast.success(res.message);
        if (res.data && res.data.errors.length > 0) {
          res.data.errors.forEach((err) => toast.error(`${err.email}: ${err.reason}`));
        }
        setBulk('');
        onDone();
      } else {
        toast.error(!res.success ? res.error : 'Lỗi');
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
              className={`px-2 py-1 rounded ${mode === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              1 người
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`px-2 py-1 rounded ${mode === 'bulk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Nhiều người
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'single' ? (
          <form onSubmit={handleSingle} className="flex gap-2">
            <input
              type="email"
              placeholder="Email học sinh..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="submit" size="sm" disabled={pending}>Thêm</Button>
          </form>
        ) : (
          <form onSubmit={handleBulk} className="space-y-2">
            <textarea
              placeholder={"Paste danh sách email (mỗi dòng 1 email, hoặc phân cách bởi dấu phẩy):\nhs1@example.com\nhs2@example.com"}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addCoTeacherAction(courseId, email);
      if (res.success) { toast.success(res.message); setEmail(''); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        placeholder="Email giáo viên (role Teacher)..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={pending}>Thêm</Button>
    </form>
  );
}

// ── Add TA panel ──────────────────────────────────────────────

function AddTAPanel({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await assignTAAction(courseId, email);
      if (res.success) { toast.success(res.message); setEmail(''); onDone(); }
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        placeholder="Email trợ giảng (role TA)..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={pending}>Gán</Button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────

export function PeoplePanel({ courseId, canManage, enrollments, tas, coTeachers, courseOwner }: Props) {
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
      const res = await unenrollAction(enrollmentId);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  async function handleRemoveTA(taId: string, name: string) {
    const ok = await openConfirm(`Xoá ${name} khỏi danh sách trợ giảng?`);
    if (!ok) return;
    startTransition(async () => {
      const res = await removeTAAction(taId);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  async function handleRemoveCoTeacher(coTeacherId: string, name: string) {
    const ok = await openConfirm(`Xoá ${name} khỏi danh sách giáo viên?`);
    if (!ok) return;
    startTransition(async () => {
      const res = await removeCoTeacherAction(coTeacherId);
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Teachers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              Giáo viên
              <Badge variant="secondary">{1 + coTeachers.length}</Badge>
            </CardTitle>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setShowAddCoTeacher((v) => !v)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Thêm
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && showAddCoTeacher && (
            <AddCoTeacherPanel
              courseId={courseId}
              onDone={() => { setShowAddCoTeacher(false); refresh(); }}
            />
          )}
          <ul className="divide-y divide-border">
            {/* Course owner — always shown, not removable */}
            <li className="flex items-center justify-between py-2 gap-3">
              <div className="flex items-center gap-3">
                <Avatar user={courseOwner} />
                <div>
                  <p className="text-sm font-medium">{userDisplayName(courseOwner)}</p>
                  <p className="text-xs text-muted-foreground">{courseOwner.email}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">Chủ khoá học</Badge>
            </li>
            {/* Co-teachers */}
            {coTeachers.map((ct) => (
              <li key={ct.id} className="flex items-center justify-between py-2 gap-3">
                <div className="flex items-center gap-3">
                  <Avatar user={ct.user} />
                  <div>
                    <p className="text-sm font-medium">{userDisplayName(ct.user)}</p>
                    <p className="text-xs text-muted-foreground">{ct.user.email}</p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemoveCoTeacher(ct.id, userDisplayName(ct.user))}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
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
            <CardTitle className="text-base flex items-center gap-2">
              Trợ giảng
              <Badge variant="secondary">{tas.length}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && (
            <AddTAPanel courseId={courseId} onDone={refresh} />
          )}
          {tas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có trợ giảng.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tas.map((ta) => (
                <li key={ta.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={ta.user} />
                    <div>
                      <p className="text-sm font-medium">{userDisplayName(ta.user)}</p>
                      <p className="text-xs text-muted-foreground">{ta.user.email}</p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleRemoveTA(ta.id, userDisplayName(ta.user))}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
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
            <CardTitle className="text-base flex items-center gap-2">
              Học sinh
              <Badge variant="secondary">{enrollments.length}</Badge>
            </CardTitle>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddStudent((v) => !v)}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Thêm
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && showAddStudent && (
            <AddStudentPanel
              courseId={courseId}
              onDone={() => { setShowAddStudent(false); refresh(); }}
            />
          )}
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có học sinh nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={e.user} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{userDisplayName(e.user)}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{Math.round(e.progress)}%</span>
                    {canManage && (
                      <button
                        onClick={() => handleUnenroll(e.id, userDisplayName(e.user))}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
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
