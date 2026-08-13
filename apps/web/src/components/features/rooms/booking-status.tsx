import {
  Ban,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogOut,
  UserX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { ROOM_BOOKING_STATUS_LABEL, type RoomBookingStatusValue } from '@lumibach/types';

/**
 * Trình bày trạng thái đơn.
 *
 * Yêu cầu khả năng tiếp cận: mỗi trạng thái luôn đi kèm BIỂU TƯỢNG và NHÃN CHỮ,
 * không bao giờ chỉ phân biệt bằng màu — người mù màu (khoảng 8% nam giới) phải
 * đọc được lịch bình thường.
 */
export type StatusVisual = {
  label: string;
  Icon: LucideIcon;
  /** Nền + chữ + viền cho khối trên lịch. */
  block: string;
  /** Vạch màu đặc bên trái khối — nhận ra trạng thái cả khi khối quá thấp. */
  bar: string;
  /** Chấm tròn nhỏ dùng trong chú giải. */
  dot: string;
};

/**
 * Nền đặc hơn và chữ sáng hơn bản đầu: bản cũ dùng nền ~15% nên trên giao diện
 * tối khối gần như chìm vào nền lịch, đọc tên người mượn rất mệt. Mỗi trạng thái
 * còn có một vạch màu bên trái để phân biệt được cả khi khối quá thấp để hiện chữ.
 */
export const STATUS_VISUAL: Record<RoomBookingStatusValue, StatusVisual> = {
  PENDING: {
    label: ROOM_BOOKING_STATUS_LABEL.PENDING,
    Icon: Clock,
    block:
      'border-amber-500/70 bg-amber-500/25 text-amber-950 dark:bg-amber-400/25 dark:text-amber-50 hover:bg-amber-500/40 dark:hover:bg-amber-400/35',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  APPROVED: {
    label: ROOM_BOOKING_STATUS_LABEL.APPROVED,
    Icon: CheckCircle2,
    block:
      'border-sky-500/70 bg-sky-500/25 text-sky-950 dark:bg-sky-400/25 dark:text-sky-50 hover:bg-sky-500/40 dark:hover:bg-sky-400/35',
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  CHECKED_IN: {
    label: ROOM_BOOKING_STATUS_LABEL.CHECKED_IN,
    Icon: DoorOpen,
    block:
      'border-emerald-500/70 bg-emerald-500/30 text-emerald-950 dark:bg-emerald-400/30 dark:text-emerald-50 hover:bg-emerald-500/45 dark:hover:bg-emerald-400/40',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  CHECKED_OUT: {
    label: ROOM_BOOKING_STATUS_LABEL.CHECKED_OUT,
    Icon: LogOut,
    block:
      'border-teal-500/70 bg-teal-500/25 text-teal-950 dark:bg-teal-400/25 dark:text-teal-50 hover:bg-teal-500/40 dark:hover:bg-teal-400/35',
    bar: 'bg-teal-500',
    dot: 'bg-teal-500',
  },
  COMPLETED: {
    label: ROOM_BOOKING_STATUS_LABEL.COMPLETED,
    Icon: CheckCircle2,
    block:
      'border-slate-400/60 bg-slate-500/20 text-slate-900 dark:bg-slate-300/20 dark:text-slate-100 hover:bg-slate-500/30 dark:hover:bg-slate-300/30',
    bar: 'bg-slate-400',
    dot: 'bg-slate-500',
  },
  REJECTED: {
    label: ROOM_BOOKING_STATUS_LABEL.REJECTED,
    Icon: XCircle,
    block:
      'border-red-500/70 bg-red-500/25 text-red-950 dark:bg-red-400/25 dark:text-red-50 hover:bg-red-500/40 dark:hover:bg-red-400/35',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
  },
  CANCELLED: {
    label: ROOM_BOOKING_STATUS_LABEL.CANCELLED,
    Icon: Ban,
    block:
      'border-zinc-400/50 bg-zinc-500/15 text-zinc-700 dark:bg-zinc-300/12 dark:text-zinc-300 hover:bg-zinc-500/25 dark:hover:bg-zinc-300/20',
    bar: 'bg-zinc-400',
    dot: 'bg-zinc-500',
  },
  NO_SHOW: {
    label: ROOM_BOOKING_STATUS_LABEL.NO_SHOW,
    Icon: UserX,
    block:
      'border-rose-500/70 bg-rose-500/25 text-rose-950 dark:bg-rose-400/25 dark:text-rose-50 hover:bg-rose-500/40 dark:hover:bg-rose-400/35',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
};

/** Nhãn trạng thái dạng chip, dùng ngoài lịch (chi tiết đơn, danh sách đơn). */
export function StatusBadge({ status }: { status: RoomBookingStatusValue }) {
  const { label, Icon, block } = STATUS_VISUAL[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${block}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Chú giải màu đặt dưới lịch. */
export function StatusLegend({ statuses }: { statuses?: readonly RoomBookingStatusValue[] }) {
  const danhSach = statuses ?? (Object.keys(STATUS_VISUAL) as RoomBookingStatusValue[]);

  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {danhSach.map((status) => {
        const { label, Icon, dot } = STATUS_VISUAL[status];
        return (
          <li key={status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
