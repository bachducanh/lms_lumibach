'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileSpreadsheet, Loader2, PackageOpen, UserX } from 'lucide-react';
import {
  EQUIPMENT_REPORT_GROUP_BY_LABEL,
  ROOM_BOOKING_STATUS_LABEL,
  vnDateLabel,
  vnDateTimeLabel,
  vnRangeLabel,
  type EquipmentNoShowReportRow,
  type EquipmentReportGroupBy,
  type EquipmentUsageReport,
  type OutstandingEquipmentReport,
  type RoomListItem,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { exportRowsToExcel, safeExcelFileName } from '@/lib/export-excel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { StatusBadge } from './booking-status';

type Tab = 'usage' | 'outstanding' | 'no-show';

const TABS: { value: Tab; label: string }[] = [
  { value: 'usage', label: 'Tần suất mượn' },
  { value: 'outstanding', label: 'Đang mượn & quá hạn' },
  { value: 'no-show', label: 'Không đến nhận' },
];

/** Ngày dạng `yyyy-MM-dd` cho ô nhập, mặc định là 30 ngày gần nhất. */
function ngayISO(lech: number): string {
  return new Date(Date.now() + lech * 86_400_000).toISOString().slice(0, 10);
}

/** "3 giờ" / "2 ngày 5 giờ" — quá hạn tính bằng ngày mới dễ hình dung. */
function nhanQuaHan(gio: number): string {
  if (gio <= 0) return '—';
  if (gio < 24) return `${Math.floor(gio)} giờ`;
  const ngay = Math.floor(gio / 24);
  const con = Math.floor(gio % 24);
  return con > 0 ? `${ngay} ngày ${con} giờ` : `${ngay} ngày`;
}

export function EquipmentReportsWorkspace({ rooms }: { rooms: RoomListItem[] }) {
  const [tab, setTab] = useState<Tab>('usage');
  const [tuNgay, setTuNgay] = useState(() => ngayISO(-30));
  const [denNgay, setDenNgay] = useState(() => ngayISO(1));
  const [groupBy, setGroupBy] = useState<EquipmentReportGroupBy>('equipment');
  const [roomId, setRoomId] = useState('');

  const [usage, setUsage] = useState<EquipmentUsageReport | null>(null);
  const [dangMuon, setDangMuon] = useState<OutstandingEquipmentReport | null>(null);
  const [noShow, setNoShow] = useState<EquipmentNoShowReportRow[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const khoang = useMemo(() => {
    const params = new URLSearchParams({
      from: new Date(`${tuNgay}T00:00:00+07:00`).toISOString(),
      to: new Date(`${denNgay}T00:00:00+07:00`).toISOString(),
    });
    if (roomId) params.set('roomId', roomId);
    return params;
  }, [tuNgay, denNgay, roomId]);

  const taiLai = useCallback(async () => {
    setDangTai(true);
    setLoi(null);
    try {
      if (tab === 'usage') {
        const params = new URLSearchParams(khoang);
        params.set('groupBy', groupBy);
        setUsage(
          await apiClient.get<EquipmentUsageReport>(`/equipment-bookings/reports/usage?${params}`)
        );
      } else if (tab === 'outstanding') {
        // Ảnh chụp tại thời điểm xem: chỉ lọc theo phòng, không theo khoảng ngày.
        const params = new URLSearchParams(roomId ? { roomId } : {});
        setDangMuon(
          await apiClient.get<OutstandingEquipmentReport>(
            `/equipment-bookings/reports/outstanding?${params}`
          )
        );
      } else {
        setNoShow(
          await apiClient.get<EquipmentNoShowReportRow[]>(
            `/equipment-bookings/reports/no-show?${khoang}`
          )
        );
      }
    } catch (err) {
      setLoi(err instanceof ApiError ? err.message : 'Không tải được báo cáo.');
    } finally {
      setDangTai(false);
    }
  }, [tab, khoang, groupBy, roomId]);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  async function xuatExcel() {
    const tieuDe = TABS.find((t) => t.value === tab)?.label ?? 'Báo cáo';
    const tenPhong = rooms.find((r) => r.id === roomId)?.name;
    const dauTrang = [
      [`BÁO CÁO MƯỢN THIẾT BỊ — ${tieuDe.toUpperCase()}`],
      [
        tab === 'outstanding'
          ? `Tính đến ${vnDateTimeLabel(new Date())}`
          : `Từ ${vnDateLabel(new Date(`${tuNgay}T00:00:00+07:00`))} đến ${vnDateLabel(new Date(`${denNgay}T00:00:00+07:00`))}`,
      ],
      [tenPhong ? `Phòng quản lý: ${tenPhong}` : 'Phòng quản lý: tất cả'],
      [`Xuất lúc ${vnDateTimeLabel(new Date())}`],
      [],
    ];

    let rows: (string | number)[][];

    if (tab === 'usage') {
      if (!usage || usage.rows.length === 0) return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        [
          EQUIPMENT_REPORT_GROUP_BY_LABEL[usage.groupBy],
          'Số đơn',
          'Tổng số lượng',
          'Tổng giờ',
          'Hoàn tất',
          'Không đến',
          'Đã huỷ',
          'Bị từ chối',
        ],
        ...usage.rows.map((r) => [
          r.label,
          r.bookingCount,
          r.itemQuantity,
          r.totalHours,
          r.completedCount,
          r.noShowCount,
          r.cancelledCount,
          r.rejectedCount,
        ]),
        [],
        ['TỔNG', usage.total.bookingCount, usage.total.itemQuantity, usage.total.totalHours],
      ];
    } else if (tab === 'outstanding') {
      if (!dangMuon || dangMuon.bookings.length === 0)
        return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        ['TỔNG HỢP THEO THIẾT BỊ'],
        ['Thiết bị', 'Mã', 'Phòng quản lý', 'Tổng kho', 'Đang mượn', 'Quá hạn', 'Đơn vị'],
        ...dangMuon.byEquipment.map((r) => [
          r.equipmentName,
          r.equipmentCode ?? '',
          r.roomName,
          r.totalQuantity,
          r.onLoanQuantity,
          r.overdueQuantity,
          r.unit,
        ]),
        [],
        ['CHI TIẾT TỪNG ĐƠN'],
        [
          'STT',
          'Phòng quản lý',
          'Khung giờ đăng ký',
          'Người mượn',
          'Mã nhân viên',
          'Tổ chuyên môn',
          'Trạng thái',
          'Quá hạn',
          'Thiết bị',
          'Số lượng',
        ],
        // Mỗi thiết bị một dòng để lọc và cộng trong Excel được.
        ...dangMuon.bookings.flatMap((r, i) =>
          r.items.map((item) => [
            i + 1,
            r.roomName,
            vnRangeLabel(new Date(r.startAt), new Date(r.endAt)),
            r.fullName,
            r.staffCode ?? '',
            r.department ?? '',
            ROOM_BOOKING_STATUS_LABEL[r.status],
            nhanQuaHan(r.overdueHours),
            `${item.equipmentName}${item.equipmentCode ? ` (${item.equipmentCode})` : ''}`,
            item.quantity,
          ])
        ),
      ];
    } else {
      if (noShow.length === 0) return toast.info('Không có số liệu để xuất.');
      rows = [
        ...dauTrang,
        [
          'STT',
          'Phòng quản lý',
          'Khung giờ đăng ký',
          'Người mượn',
          'Mã nhân viên',
          'Tổ chuyên môn',
          'Thiết bị',
          'Số lượng',
          'Lý do mượn',
        ],
        ...noShow.flatMap((r, i) =>
          r.items.map((item) => [
            i + 1,
            r.roomName,
            vnRangeLabel(new Date(r.startAt), new Date(r.endAt)),
            r.fullName,
            r.staffCode ?? '',
            r.department ?? '',
            `${item.equipmentName}${item.equipmentCode ? ` (${item.equipmentCode})` : ''}`,
            item.quantity,
            r.reason,
          ])
        ),
      ];
    }

    await exportRowsToExcel({
      rows,
      fileName: `bao-cao-thiet-bi-${safeExcelFileName(tieuDe)}-${tab === 'outstanding' ? ngayISO(0) : tuNgay}`,
      sheetName: 'Bao cao',
    });
    toast.success('Đã xuất báo cáo');
  }

  const theoNgay = tab !== 'outstanding';

  return (
    <div className="space-y-4">
      {/* Thanh điều kiện */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="tb-tu-ngay" className="text-muted-foreground text-xs font-medium">
            Từ ngày
          </label>
          <Input
            id="tb-tu-ngay"
            type="date"
            value={tuNgay}
            disabled={!theoNgay}
            onChange={(e) => setTuNgay(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="tb-den-ngay" className="text-muted-foreground text-xs font-medium">
            Đến ngày
          </label>
          <Input
            id="tb-den-ngay"
            type="date"
            value={denNgay}
            disabled={!theoNgay}
            onChange={(e) => setDenNgay(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-muted-foreground block text-xs font-medium">Phòng quản lý</label>
          <SimpleSelect
            aria-label="Phòng quản lý thiết bị"
            value={roomId || 'tat-ca'}
            onValueChange={(v) => setRoomId(v === 'tat-ca' ? '' : v)}
            options={[
              { value: 'tat-ca', label: 'Tất cả phòng' },
              ...rooms.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </div>

        {tab === 'usage' && (
          <div className="space-y-1">
            <label className="text-muted-foreground block text-xs font-medium">Gom nhóm</label>
            <SimpleSelect
              aria-label="Gom nhóm"
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as EquipmentReportGroupBy)}
              options={(
                Object.keys(EQUIPMENT_REPORT_GROUP_BY_LABEL) as EquipmentReportGroupBy[]
              ).map((k) => ({ value: k, label: EQUIPMENT_REPORT_GROUP_BY_LABEL[k] }))}
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

      {!theoNgay && (
        <p className="text-muted-foreground text-xs">
          Báo cáo này là ảnh chụp tại thời điểm xem nên không tính theo khoảng ngày — thiết bị mượn
          từ lâu chưa trả vẫn hiện ở đây.
        </p>
      )}

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
      {!dangTai && !loi && tab === 'outstanding' && dangMuon && <BangDangMuon report={dangMuon} />}
      {!dangTai && !loi && tab === 'no-show' && <BangKhongDenNhan rows={noShow} />}
    </div>
  );
}

function BangTanSuat({ report }: { report: EquipmentUsageReport }) {
  if (report.rows.length === 0)
    return <Rong noiDung="Không có đơn mượn thiết bị nào trong khoảng đã chọn." />;

  return (
    <div className="space-y-2">
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th className="text-left">{EQUIPMENT_REPORT_GROUP_BY_LABEL[report.groupBy]}</Th>
              <Th>Số đơn</Th>
              <Th>Tổng số lượng</Th>
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
                <Td>{r.itemQuantity}</Td>
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
              <Td>{report.total.itemQuantity}</Td>
              <Td>{report.total.totalHours}</Td>
              <Td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      {report.groupBy === 'equipment' && (
        <p className="text-muted-foreground text-xs">
          Một đơn mượn nhiều loại thiết bị được đếm ở từng dòng thiết bị, nên tổng số đơn nhỏ hơn
          tổng các dòng phía trên.
        </p>
      )}
    </div>
  );
}

function BangDangMuon({ report }: { report: OutstandingEquipmentReport }) {
  if (report.bookings.length === 0)
    return <Rong noiDung="Mọi thiết bị đã được trả và xác nhận." icon={PackageOpen} />;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Tổng hợp theo thiết bị</h2>
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <Th className="text-left">Thiết bị</Th>
                <Th className="text-left">Phòng quản lý</Th>
                <Th>Tổng kho</Th>
                <Th>Đang mượn</Th>
                <Th>Trong đó quá hạn</Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {report.byEquipment.map((r) => (
                <tr key={r.equipmentId}>
                  <Td className="text-left font-medium">
                    {r.equipmentName}
                    {r.equipmentCode && (
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · {r.equipmentCode}
                      </span>
                    )}
                  </Td>
                  <Td className="text-left">{r.roomName}</Td>
                  <Td>
                    {r.totalQuantity} {r.unit}
                  </Td>
                  <Td className="font-semibold">{r.onLoanQuantity}</Td>
                  <Td className={r.overdueQuantity > 0 ? 'text-destructive font-semibold' : ''}>
                    {r.overdueQuantity}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Chi tiết từng đơn</h2>
        <div className="space-y-3">
          {report.bookings.map((r) => (
            <div
              key={r.bookingId}
              className={cn(
                'border-border rounded-xl border p-4',
                r.overdueHours > 0 && 'border-destructive/40 bg-destructive/5'
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {r.fullName}
                  {r.staffCode && <span className="text-muted-foreground"> · {r.staffCode}</span>}
                  {r.department && <span className="text-muted-foreground"> · {r.department}</span>}
                </p>
                <StatusBadge status={r.status} />
              </div>

              <p className="text-muted-foreground mt-1 text-xs">
                {r.roomName} · {vnRangeLabel(new Date(r.startAt), new Date(r.endAt))}
              </p>

              {r.overdueHours > 0 && (
                <p className="text-destructive mt-1 flex items-center gap-1.5 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Quá hạn trả {nhanQuaHan(r.overdueHours)}
                </p>
              )}

              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {r.items.map((item) => (
                  <li key={item.equipmentId} className="text-muted-foreground">
                    <span className="text-foreground font-medium">{item.equipmentName}</span>{' '}
                    {item.quantity} {item.unit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BangKhongDenNhan({ rows }: { rows: EquipmentNoShowReportRow[] }) {
  if (rows.length === 0)
    return (
      <Rong noiDung="Không có đơn mượn thiết bị nào bị đánh dấu không đến nhận." icon={UserX} />
    );

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <Th className="text-left">Phòng quản lý</Th>
            <Th className="text-left">Khung giờ đăng ký</Th>
            <Th className="text-left">Người mượn</Th>
            <Th className="text-left">Tổ chuyên môn</Th>
            <Th className="text-left">Thiết bị</Th>
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
              <Td className="text-left">
                {r.items.map((item) => `${item.equipmentName} ×${item.quantity}`).join(', ')}
              </Td>
              <Td className="text-muted-foreground max-w-xs truncate text-left">{r.reason}</Td>
            </tr>
          ))}
        </tbody>
      </table>
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
