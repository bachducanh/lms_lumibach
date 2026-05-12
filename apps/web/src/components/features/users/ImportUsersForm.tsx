'use client';

import { useState, useTransition } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { importUsersAction, type ImportRow, type ImportResult } from '@/actions/users';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

const TEMPLATE_ROWS = [
  {
    'Full Name': 'Nguyễn Văn A',
    Email: 'nguyenvana@example.com',
    Username: 'nguyenvana',
    Password: '',
    Role: 'STUDENT',
    'Course 1': 'tin-hoc-10',
    'Course 2': 'tin-hoc-11',
    'Course 3': '',
  },
  {
    'Full Name': 'Trần Thị B',
    Email: 'tranthib@example.com',
    Username: '',
    Password: 'TranThiB123',
    Role: 'STUDENT',
    'Course 1': 'tin-hoc-10',
    'Course 2': '',
    'Course 3': '',
  },
  {
    'Full Name': 'Lê Văn C',
    Email: 'levanc@example.com',
    Username: 'levanc',
    Password: '',
    Role: 'TA',
    'Course 1': 'tin-hoc-12',
    'Course 2': '',
    'Course 3': '',
  },
  {
    'Full Name': 'Phạm Thị D',
    Email: 'phamthid@example.com',
    Username: '',
    Password: '',
    Role: 'TEACHER',
    'Course 1': '',
    'Course 2': '',
    'Course 3': '',
  },
];

function downloadTemplate() {
  const ws = utils.json_to_sheet(TEMPLATE_ROWS);
  ws['!cols'] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } };
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1'].forEach((cell) => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Danh sách người dùng');
  writeFile(wb, 'mau-import-nguoi-dung.xlsx');
}

// "Course 1", "Course2", "course_3", "Khoá học 1" → catches all
const COURSE_COL_RE = /^(course|khoá ?học)[ _-]?\d+$/i;

function pickCourseSlugs(row: Record<string, string>): string[] {
  const slugs: string[] = [];
  for (const key of Object.keys(row)) {
    if (COURSE_COL_RE.test(key.trim())) {
      const v = (row[key] ?? '').toString().trim();
      if (v) slugs.push(v);
    }
  }
  return slugs;
}

export function ImportUsersForm() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = read(ev.target?.result, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return;
      const ws = wb.Sheets[sheetName];
      if (!ws) return;
      const raw = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const VALID_ROLES = ['ADMIN', 'TEACHER', 'TA', 'STUDENT'] as const;
      const parsed: ImportRow[] = raw.map((r) => {
        const roleRaw = (r['Role'] ?? r['role'] ?? r['Vai trò'] ?? '')
          .toString()
          .trim()
          .toUpperCase();
        return {
          fullName: (r['Full Name'] ?? r['fullName'] ?? r['Họ tên'] ?? r['name'] ?? '')
            .toString()
            .trim(),
          email: (r['Email'] ?? r['email'] ?? '').toString().trim().toLowerCase(),
          username:
            (r['Username'] ?? r['username'] ?? r['Tên đăng nhập'] ?? '').toString().trim() ||
            undefined,
          password:
            (r['Password'] ?? r['password'] ?? r['Mật khẩu'] ?? '').toString().trim() || undefined,
          role: (VALID_ROLES as readonly string[]).includes(roleRaw)
            ? (roleRaw as ImportRow['role'])
            : 'STUDENT',
          courseSlugs: pickCourseSlugs(r),
        };
      });

      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleImport() {
    startTransition(async () => {
      const res = await importUsersAction(rows);
      if (res.success && res.data) {
        setResult(res.data);
        toast.success(res.message);
      } else {
        toast.error(!res.success ? res.error : 'Lỗi import');
      }
    });
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Kết quả import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">{result.success} thành công</Badge>
              {result.errors.length > 0 && (
                <Badge variant="destructive">{result.errors.length} lỗi</Badge>
              )}
              {result.enrollments.length > 0 && (
                <Badge variant="secondary">
                  {result.enrollments.reduce((s, e) => s + e.enrolled.length, 0)} lượt enroll
                </Badge>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Chi tiết lỗi:</p>
                {result.errors.map((e) => (
                  <p key={e.row} className="text-destructive text-xs">
                    Dòng {e.row}: {e.email} — {e.reason}
                  </p>
                ))}
              </div>
            )}

            {result.enrollments.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Enroll vào khoá học:</p>
                <div className="bg-muted/40 max-h-48 space-y-1.5 overflow-y-auto rounded-lg p-3">
                  {result.enrollments.map((e) => (
                    <div key={e.email} className="text-xs">
                      <span className="text-muted-foreground font-mono">{e.email}</span>
                      {e.enrolled.length > 0 && (
                        <span className="ml-2 text-emerald-400">→ {e.enrolled.join(', ')}</span>
                      )}
                      {e.missing.length > 0 && (
                        <span className="ml-2 text-amber-400">
                          ⚠ slug sai: {e.missing.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.passwords.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Mật khẩu (sao chép ngay — chỉ hiển thị 1 lần):
                </p>
                <div className="bg-muted max-h-60 overflow-y-auto rounded-lg p-3">
                  <table className="w-full font-mono text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="pb-2 text-left">Tên</th>
                        <th className="pb-2 text-left">Email</th>
                        <th className="pb-2 text-left">Mật khẩu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {result.passwords.map((p) => (
                        <tr key={p.email}>
                          <td className="py-1 pr-4">{p.fullName}</td>
                          <td className="py-1 pr-4">{p.email}</td>
                          <td className="py-1 font-bold">{p.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setRows([]);
                setFilename('');
              }}
            >
              Import thêm
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="mb-2 block text-sm font-medium">File Excel (.xlsx, .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="text-muted-foreground file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs"
            />
          </div>
          <div className="bg-muted/50 text-muted-foreground space-y-2 rounded-lg p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-foreground font-medium">Định dạng cột:</p>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Tải file mẫu
              </Button>
            </div>
            <ul className="list-inside list-disc space-y-0.5">
              <li>
                <strong>Full Name</strong> (bắt buộc)
              </li>
              <li>
                <strong>Email</strong> (bắt buộc)
              </li>
              <li>Username (tuỳ chọn)</li>
              <li>Password (tuỳ chọn — bỏ trống để hệ thống tạo random)</li>
              <li>Role: ADMIN / TEACHER / TA / STUDENT (mặc định STUDENT)</li>
              <li>
                <strong>Course 1, Course 2, Course 3...</strong> — slug khoá học (vd{' '}
                <code>tin-hoc-10</code>) để enroll luôn vào lớp
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Preview — {rows.length} dòng từ {filename}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="ring-foreground/10 max-h-96 overflow-auto rounded-lg ring-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Họ tên</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Username</th>
                    <th className="px-3 py-2 text-left font-medium">MK</th>
                    <th className="px-3 py-2 text-left font-medium">Vai trò</th>
                    <th className="px-3 py-2 text-left font-medium">Khoá học</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="text-muted-foreground px-3 py-2">{i + 2}</td>
                      <td className="px-3 py-2">
                        {r.fullName || <span className="text-destructive">Thiếu</span>}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {r.email || <span className="text-destructive">Thiếu</span>}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">{r.username ?? '—'}</td>
                      <td className="text-muted-foreground px-3 py-2">
                        {r.password ? '✓' : <span className="italic">auto</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{r.role ?? 'STUDENT'}</Badge>
                      </td>
                      <td className="text-muted-foreground px-3 py-2 text-xs">
                        {r.courseSlugs && r.courseSlugs.length > 0 ? r.courseSlugs.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleImport} disabled={pending}>
              {pending ? 'Đang import...' : `Import ${rows.length} người dùng`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
