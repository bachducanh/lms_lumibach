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
  { 'Full Name': 'Nguyễn Văn A', Email: 'nguyenvana@example.com', Username: 'nguyenvana', Role: 'STUDENT' },
  { 'Full Name': 'Trần Thị B',   Email: 'tranthib@example.com',   Username: '',            Role: 'STUDENT' },
  { 'Full Name': 'Lê Văn C',     Email: 'levanc@example.com',     Username: 'levanc',      Role: 'TA'      },
  { 'Full Name': 'Phạm Thị D',   Email: 'phamthid@example.com',   Username: '',            Role: 'TEACHER' },
];

function downloadTemplate() {
  const ws = utils.json_to_sheet(TEMPLATE_ROWS);

  // Đặt độ rộng cột
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 12 }];

  // In đậm header row
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'EEF2FF' } } };
  ['A1', 'B1', 'C1', 'D1'].forEach((cell) => {
    if (ws[cell]) ws[cell].s = headerStyle;
  });

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Danh sách người dùng');
  writeFile(wb, 'mau-import-nguoi-dung.xlsx');
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
        const roleRaw = (r['Role'] ?? r['role'] ?? r['Vai trò'] ?? '').trim().toUpperCase();
        return {
          fullName: (r['Full Name'] ?? r['fullName'] ?? r['Họ tên'] ?? r['name'] ?? '').trim(),
          email: (r['Email'] ?? r['email'] ?? '').trim().toLowerCase(),
          username: (r['Username'] ?? r['username'] ?? r['Tên đăng nhập'] ?? '').trim() || undefined,
          role: (VALID_ROLES as readonly string[]).includes(roleRaw)
            ? (roleRaw as ImportRow['role'])
            : 'STUDENT',
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
            <div className="flex gap-3">
              <Badge variant="default">{result.success} thành công</Badge>
              {result.errors.length > 0 && (
                <Badge variant="destructive">{result.errors.length} lỗi</Badge>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Chi tiết lỗi:</p>
                {result.errors.map((e) => (
                  <p key={e.row} className="text-xs text-destructive">
                    Dòng {e.row}: {e.email} — {e.reason}
                  </p>
                ))}
              </div>
            )}
            {result.passwords.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Mật khẩu tạm thời (sao chép ngay):</p>
                <div className="max-h-60 overflow-y-auto rounded-lg bg-muted p-3">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left pb-2">Tên</th>
                        <th className="text-left pb-2">Email</th>
                        <th className="text-left pb-2">Mật khẩu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
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
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">File Excel (.xlsx, .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
            />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Định dạng cột:</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Tải file mẫu
              </Button>
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>Full Name</strong> (bắt buộc)</li>
              <li><strong>Email</strong> (bắt buộc)</li>
              <li>Username (tuỳ chọn)</li>
              <li>Role: ADMIN / TEACHER / TA / STUDENT (tuỳ chọn, mặc định STUDENT)</li>
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
            <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Họ tên</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Vai trò</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{i + 2}</td>
                      <td className="px-3 py-2">{r.fullName || <span className="text-destructive">Thiếu</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.email || <span className="text-destructive">Thiếu</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{r.role ?? 'STUDENT'}</Badge>
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
