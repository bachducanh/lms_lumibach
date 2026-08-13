import { ConflictException } from '@nestjs/common';
import type { RoomBookingStatus } from '@lumibach/db';
import { ROOM_BOOKING_STATUS_LABEL } from '@lumibach/types';

/**
 * State machine cho vòng đời đơn mượn phòng / mượn thiết bị.
 *
 * Mọi thay đổi trạng thái PHẢI đi qua `assertTransition` — không service nào
 * được gán `status` trực tiếp. Bảng dưới đây là nguồn sự thật duy nhất; thêm
 * trạng thái mới mà quên khai ở đây thì test ma trận sẽ đỏ.
 */

/** Hành động gây ra chuyển trạng thái. Dùng để ra thông báo lỗi cho đúng ngữ cảnh. */
export type BookingAction =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'reschedule'
  | 'checkin'
  | 'checkout'
  | 'complete'
  | 'markNoShow';

/** Ai được phép thực hiện hành động. */
export type ActorKind = 'owner' | 'admin';

type TransitionRule = {
  from: readonly RoomBookingStatus[];
  to: RoomBookingStatus;
  /** Vai trò được phép. Admin luôn làm được mọi việc của owner, xem `canActorPerform`. */
  actor: ActorKind;
};

export const TRANSITIONS: Record<BookingAction, TransitionRule> = {
  approve: { from: ['PENDING'], to: 'APPROVED', actor: 'admin' },
  // Từ chối được cả đơn ĐÃ DUYỆT: thực tế phòng có thể bị trưng dụng đột xuất
  // sau khi đã duyệt. Chỉ dừng ở trước lúc nhận phòng — đơn đang sử dụng thì
  // không rút lại được nữa, phải để người mượn trả phòng cho đủ quy trình.
  reject: { from: ['PENDING', 'APPROVED'], to: 'REJECTED', actor: 'admin' },
  cancel: { from: ['PENDING', 'APPROVED'], to: 'CANCELLED', actor: 'owner' },
  // Sửa giờ hoặc đổi phòng một đơn ĐÃ DUYỆT sẽ đẩy nó về hàng chờ: admin là
  // người giao chìa khoá nên không được để lịch đổi sau lưng họ.
  reschedule: { from: ['PENDING', 'APPROVED'], to: 'PENDING', actor: 'owner' },
  checkin: { from: ['APPROVED'], to: 'CHECKED_IN', actor: 'owner' },
  checkout: { from: ['CHECKED_IN'], to: 'CHECKED_OUT', actor: 'owner' },
  complete: { from: ['CHECKED_OUT'], to: 'COMPLETED', actor: 'admin' },
  markNoShow: { from: ['APPROVED'], to: 'NO_SHOW', actor: 'admin' },
};

/** Trạng thái kết thúc — không còn hành động nào hợp lệ. */
export const TERMINAL_STATUSES: readonly RoomBookingStatus[] = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'NO_SHOW',
];

export function isTerminal(status: RoomBookingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: RoomBookingStatus, action: BookingAction): boolean {
  return TRANSITIONS[action].from.includes(from);
}

/** Admin làm được cả việc của owner; owner thì không làm được việc của admin. */
export function canActorPerform(actor: ActorKind, action: BookingAction): boolean {
  const required = TRANSITIONS[action].actor;
  return actor === 'admin' || required === 'owner';
}

/** Các hành động hợp lệ tiếp theo — dùng để bật/tắt nút trên giao diện. */
export function availableActions(
  from: RoomBookingStatus,
  actor: ActorKind
): readonly BookingAction[] {
  return (Object.keys(TRANSITIONS) as BookingAction[]).filter(
    (action) => canTransition(from, action) && canActorPerform(actor, action)
  );
}

/** Quan hệ của người đang xem với một đơn cụ thể. */
export type ViewerRelation = {
  isOwner: boolean;
  isAdmin: boolean;
};

/**
 * Hành động người đang xem thực sự làm được trên MỘT đơn cụ thể.
 *
 * Khác `availableActions` ở chỗ có tính quyền sở hữu: hành động của chủ đơn
 * (huỷ, đổi lịch, nhận/trả phòng) đòi hỏi ĐÚNG người đó, admin không làm hộ
 * được — khớp với `requireOwnBooking` ở service. Dùng hàm này để dựng danh sách
 * nút trên giao diện, nếu không admin sẽ thấy nút bấm vào là nhận 403.
 */
export function availableActionsFor(
  from: RoomBookingStatus,
  viewer: ViewerRelation
): readonly BookingAction[] {
  return (Object.keys(TRANSITIONS) as BookingAction[]).filter((action) => {
    if (!canTransition(from, action)) return false;
    return TRANSITIONS[action].actor === 'owner' ? viewer.isOwner : viewer.isAdmin;
  });
}

const ACTION_LABEL: Record<BookingAction, string> = {
  approve: 'duyệt đơn',
  reject: 'từ chối đơn',
  cancel: 'huỷ đơn',
  reschedule: 'đổi thời gian hoặc phòng',
  checkin: 'nhận phòng',
  checkout: 'trả phòng',
  complete: 'xác nhận đã nhận lại chìa khoá',
  markNoShow: 'đánh dấu không đến nhận',
};

/**
 * Chặn mọi bước nhảy không hợp lệ. Ném ConflictException (409) với thông báo
 * tiếng Việt nói rõ đơn đang ở trạng thái nào — đủ để người dùng hiểu vì sao
 * nút vừa bấm không có tác dụng (thường là do tab khác đã đổi trạng thái).
 *
 * @returns trạng thái mới, để service dùng luôn thay vì tự viết lại.
 */
export function assertTransition(
  from: RoomBookingStatus,
  action: BookingAction
): RoomBookingStatus {
  const rule = TRANSITIONS[action];
  if (rule.from.includes(from)) return rule.to;

  const dangO = ROOM_BOOKING_STATUS_LABEL[from];
  throw new ConflictException(
    isTerminal(from)
      ? `Không thể ${ACTION_LABEL[action]}: đơn đã kết thúc ở trạng thái "${dangO}".`
      : `Không thể ${ACTION_LABEL[action]} khi đơn đang ở trạng thái "${dangO}".`
  );
}
