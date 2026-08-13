'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileSpreadsheet, Loader2, UserX } from 'lucide-react';
import {
  REPORT_GROUP_BY_LABEL,
  vnDateLabel,
  vnDateTimeLabel,
  vnRangeLabel,
  type DiscrepancyReportRow,
  type NoShowReportRow,
  type ReportGroupBy,
  type UsageReport,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportRowsToExcel, safeExcelFileName } from '@/lib/export-excel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';

type Tab = 'usage' | 'no-show' | 'discrepancies';

const TABS: { value: Tab; label: string }[] = [
  { value: 'usage', label: 'Tần suất sử dụng' },
  { value: 'no-show', label: 'Không đến nhận' },
  { value: 'discrepancies', label: 'Bàn giao thiếu' },
];

/** Ngày dạng `yyyy-MM-dd` cho ô nhập, mặc định là 30 ngày gần nhất. */
function ngayISO(lech: number): string {
  return new Date(Date.now() + lech * 86_400_000).toISOString().slice(0, 10);
}

export function RoomReportsWorkspace() {
  const [tab, setTab] = useState<Tab>('usage');
  const [tuNgay, setTuNgay] = useState(() => ngayISO(-30));
  const [denNgay, setDenNgay] = useState(() => ngayISO(1));
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('room');

  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [noShow, setNoShow] = useState<NoShowReportRow[]>([]);
  const [lech, setLech] = useState<DiscrepancyReportRow[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const khoang = useMemo(() => {
    const params = new URLSearchParams({
      from: new Date(`${tuNgay}T00:00:00+07:00`).toISOString(),
      to: new Date(`${denNgay}T00:00:00+07:00`).toISOString(),
    });
    return params;
  }, [tuNgay, denNgay]);

  const taiLai = useCallback(async () => {
    setDangTai(true);
    setLoi(null);
    try {
      if (tab === 'usage') {
        const params = new URLSearchParams(khoang);
        params.set('groupBy', groupBy);
        setUsage(await apiClient.get<UsageReport>(`/rooms/reports/usage?${params}`));
      } else if (tab === 'no-show') {
        setNoShow(await apiClient.get<NoShowReportRow[]>(`/rooms/reports/no-show?${khoang}`));
      } else {
        setLech(
          await apiClient.get<DiscrepancyReportRow[]>(`/rooms/reports/discrepancies?${khoang}`)
        );
      }
    } catch (err) {
      setLoi(err instanceof ApiError ? err.message : 'Không tải được báo cáo.');
    } finally {
      setDangTai(false);
    }
  }, [tab, khoang, groupBy]);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  async function xuatExcel() {
    const tieuDe = TABS.find((t) => t.value === tab)?.label ?? 'Báo cáo';
    const dauTrang = [
      [`BÁO CÁO PHÒNG CHỨC NĂNG — ${tieuDe.toUpperCase()}`],
      [
        `Từ ${vnDateLabel(new Date(`${tuNgay}T00:00:00+07:00`))} đến ${vnDateLabel(new Date(`${denNgay}T00:00:00+07:00`))}`,
      ],
      [`Xuất lúc ${vnDateTimeLabel(new Date())}`],
      [],
    ];

    let rows: (string | number)[][];

    if (tab === 'usage') {
      if (!usage || usage.rows.length === 0) return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        [
          REPORT_GROUP_BY_LABEL[usage.groupBy],
          'Số đơn',
          'Tổng giờ',
          'Hoàn tất',
          'Không đến',
          'Đã huỷ',
          'Bị từ chối',
        ],
        ...usage.rows.map((r) => [
          r.label,
          r.bookingCount,
          r.totalHours,
          r.completedCount,
          r.noShowCount,
          r.cancelledCount,
          r.rejectedCount,
        ]),
        [],
        ['TỔNG', usage.total.bookingCount, usage.total.totalHours],
      ];
    } else if (tab === 'no-show') {
      if (noShow.length === 0) return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        ['STT', 'Phòng', 'Thời gian', 'Người mượn', 'Mã nhân viên', 'Tổ chuyên môn', 'Lý do mượn'],
        ...noShow.map((r, i) => [
          i + 1,
          r.roomName,
          vnRangeLabel(new Date(r.startAt), new Date(r.endAt)),
          r.fullName,
          r.staffCode ?? '',
          r.department ?? '',
          r.reason,
        ]),
      ];
    } else {
      if (lech.length === 0) return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        [
          'STT',
          'Phòng',
          'Thời gian',
          'Người mượn',
          'Tổ chuyên môn',
          'Thiết bị thiếu',
          'Lúc nhận',
          'Lúc trả',
          'Thiếu',
        ],
        // Mỗi trường thiếu một dòng riêng để lọc và cộng trong Excel được.
        ...lech.flatMap((r, i) =>
          r.shortfalls.map((s) => [
            i + 1,
            r.roomName,
            vnRangeLabel(new Date(r.startAt), new Date(r.endAt)),
            r.fullName,
            r.department ?? '',
            s.label,
            s.checkinValue,
            s.checkoutValue,
            s.shortfall,
          ])
        ),
      ];
    }

    await exportRowsToExcel({
      rows,
      fileName: `bao-cao-phong-${safeExcelFileName(tieuDe)}-${tuNgay}`,
      sheetName: 'Bao cao',
    });
    toast.success('Đã xuất báo cáo');
  }

  return (
    <div className="space-y-4">
      {/* Thanh điều kiện */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="tu-ngay" className="text-muted-foreground text-xs font-medium">
            Từ ngày
          </label>
          <Input
            id="tu-ngay"
            type="date"
            value={tuNgay}
            onChange={(e) => setTuNgay(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="den-ngay" className="text-muted-foreground text-xs font-medium">
            Đến ngày
          </label>
          <Input
            id="den-ngay"
            type="date"
            value={denNgay}
            onChange={(e) => setDenNgay(e.target.value)}
            className="w-40"
          />
        </div>

        {tab === 'usage' && (
          <div className="space-y-1">
            <label className="text-muted-foreground block text-xs font-medium">Gom nhóm</label>
            <SimpleSelect
              aria-label="Gom nhóm"
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as ReportGroupBy)}
              options={(Object.keys(REPORT_GROUP_BY_LABEL) as ReportGroupBy[]).map((k) => ({
                value: k,
                label: REPORT_GROUP_BY_LABEL[k],
              }))}
            />
          </div>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={xuatExcel} disabled={dangTai}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Xuất Excel
        </Button>
      </div>

      {/* Chọn loại báo cáo */}
      <div className="border-border flex w-fit overflow-hidden rounded-lg border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loi && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {loi}
        </p>
      )}

      {dangTai && (
        <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tổng hợp…
        </p>
      )}

      {!dangTai && !loi && tab === 'usage' && usage && <BangTanSuat report={usage} />}
      {!dangTai && !loi && tab === 'no-show' && <BangKhongDenNhan rows={noShow} />}
      {!dangTai && !loi && tab === 'discrepancies' && <BangThieu rows={lech} />}
    </div>
  );
}

function BangTanSuat({ report }: { report: UsageReport }) {
  if (report.rows.length === 0) return <Rong noiDung="Không có đơn nào trong khoảng đã chọn." />;

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th className="text-left">{REPORT_GROUP_BY_LABEL[report.groupBy]}</Th>
            <Th>Số đơn</Th>
            <Th>Tổng giờ</Th>
            <Th>Hoàn tất</Th>
            <Th>Không đến</Th>
            <Th>Đã huỷ</Th>
            <Th>Bị từ chối</Th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {report.rows.map((r) => (
            <tr key={r.key}>
              <Td className="text-left font-medium">{r.label}</Td>
              <Td>{r.bookingCount}</Td>
              <Td>{r.totalHours}</Td>
              <Td>{r.completedCount}</Td>
              <Td className={r.noShowCount > 0 ? 'text-destructive font-semibold' : ''}>
                {r.noShowCount}
              </Td>
              <Td>{r.cancelledCount}</Td>
              <Td>{r.rejectedCount}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-semibold">
          <tr>
            <Td className="text-left">Tổng</Td>
            <Td>{report.total.bookingCount}</Td>
            <Td>{report.total.totalHours}</Td>
            <Td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BangKhongDenNhan({ rows }: { rows: NoShowReportRow[] }) {
  if (rows.length === 0)
    return <Rong noiDung="Không có đơn nào bị đánh dấu không đến nhận." icon={UserX} />;

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th className="text-left">Phòng</Th>
            <Th className="text-left">Thời gian</Th>
            <Th className="text-left">Người mượn</Th>
            <Th className="text-left">Tổ chuyên môn</Th>
            <Th className="text-left">Lý do mượn</Th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="text-left font-medium">{r.roomName}</Td>
              <Td className="text-left tabular-nums">
                {vnRangeLabel(new Date(r.startAt), new Date(r.endAt))}
              </Td>
              <Td className="text-left">
                {r.fullName}
                {r.staffCode && <span className="text-muted-foreground"> · {r.staffCode}</span>}
              </Td>
              <Td className="text-left">{r.department ?? '—'}</Td>
              <Td className="text-muted-foreground max-w-xs truncate text-left">{r.reason}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BangThieu({ rows }: { rows: DiscrepancyReportRow[] }) {
  if (rows.length === 0)
    return <Rong noiDung="Không có lượt bàn giao nào trả thiếu." icon={AlertTriangle} />;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.bookingId} className="border-border rounded-xl border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {r.roomName} · {vnRangeLabel(new Date(r.startAt), new Date(r.endAt))}
            </p>
            <p className="text-muted-foreground text-xs">
              {r.fullName}
              {r.department && ` · ${r.department}`}
            </p>
          </div>

          <ul className="mt-2 space-y-1 text-sm">
            {r.shortfalls.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">{s.label}:</span>
                <span className="text-muted-foreground tabular-nums">
                  nhận {s.checkinValue} → trả {s.checkoutValue}
                </span>
                <span className="text-destructive font-semibold">thiếu {s.shortfall}</span>
              </li>
            ))}
          </ul>

          {r.adminReviewNote && (
            <p className="text-muted-foreground mt-2 text-xs">Ghi chú: {r.adminReviewNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Rong({
  noiDung,
  icon: Icon = FileSpreadsheet,
}: {
  noiDung: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
      <Icon className="mx-auto mb-3 h-9 w-9 opacity-40" />
      {noiDung}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-3 py-2.5 text-right font-semibold whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn('px-3 py-2.5 text-right tabular-nums', className)}>
      {children}
    </td>
  );
}
