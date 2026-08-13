import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { RoomBookingStatus } from '@lumibach/db';
import {
  assertTransition,
  availableActions,
  availableActionsFor,
  canActorPerform,
  canTransition,
  isTerminal,
  TERMINAL_STATUSES,
  TRANSITIONS,
  type BookingAction,
} from '@/modules/rooms/booking-state';

const MOI_TRANG_THAI: readonly RoomBookingStatus[] = [
  'PENDING',
  'APPROVED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'NO_SHOW',
];

const MOI_HANH_DONG = Object.keys(TRANSITIONS) as BookingAction[];

/**
 * Ma trận đầy đủ 8 trạng thái × 8 hành động. Ô nào ghi ở đây là hợp lệ, mọi ô
 * còn lại PHẢI bị chặn. Viết tay có chủ đích: nếu sinh ra từ chính TRANSITIONS
 * thì test sẽ luôn xanh kể cả khi bảng chuyển trạng thái bị sửa sai.
 */
const O_HOP_LE: Record<BookingAction, readonly RoomBookingStatus[]> = {
  approve: ['PENDING'],
  // Đơn đã duyệt vẫn rút lại được khi phòng bị trưng dụng đột xuất.
  reject: ['PENDING', 'APPROVED'],
  cancel: ['PENDING', 'APPROVED'],
  reschedule: ['PENDING', 'APPROVED'],
  checkin: ['APPROVED'],
  checkout: ['CHECKED_IN'],
  complete: ['CHECKED_OUT'],
  markNoShow: ['APPROVED'],
};

describe('Ma trận chuyển trạng thái', () => {
  for (const action of MOI_HANH_DONG) {
    for (const from of MOI_TRANG_THAI) {
      const hopLe = O_HOP_LE[action].includes(from);

      it(`${from} --${action}--> ${hopLe ? 'cho phép' : 'CHẶN'}`, () => {
        expect(canTransition(from, action)).toBe(hopLe);

        if (hopLe) {
          expect(assertTransition(from, action)).toBe(TRANSITIONS[action].to);
        } else {
          expect(() => assertTransition(from, action)).toThrow(ConflictException);
        }
      });
    }
  }
});

describe('Trạng thái kết thúc', () => {
  it.each(TERMINAL_STATUSES)('%s không còn hành động nào hợp lệ', (status) => {
    expect(isTerminal(status)).toBe(true);
    expect(availableActions(status, 'admin')).toEqual([]);
  });

  it.each(['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT'] as const)(
    '%s vẫn còn hành động tiếp theo',
    (status) => {
      expect(isTerminal(status)).toBe(false);
      expect(availableActions(status, 'admin').length).toBeGreaterThan(0);
    }
  );

  it('thông báo lỗi cho trạng thái kết thúc nói rõ là đơn đã kết thúc', () => {
    expect(() => assertTransition('CANCELLED', 'approve')).toThrow(/đã kết thúc/);
    expect(() => assertTransition('PENDING', 'checkin')).toThrow(/đang ở trạng thái/);
  });

  it('thông báo lỗi dùng nhãn tiếng Việt của trạng thái', () => {
    expect(() => assertTransition('CHECKED_IN', 'approve')).toThrow(/Đang sử dụng/);
  });
});

describe('Phân quyền theo hành động', () => {
  it.each(['approve', 'reject', 'complete', 'markNoShow'] as const)(
    'chủ đơn KHÔNG tự %s được',
    (action) => {
      expect(canActorPerform('owner', action)).toBe(false);
      expect(canActorPerform('admin', action)).toBe(true);
    }
  );

  it.each(['cancel', 'reschedule', 'checkin', 'checkout'] as const)(
    'chủ đơn tự %s được, và admin cũng làm được',
    (action) => {
      expect(canActorPerform('owner', action)).toBe(true);
      expect(canActorPerform('admin', action)).toBe(true);
    }
  );

  it('chủ đơn ở trạng thái chờ duyệt chỉ thấy huỷ và đổi lịch', () => {
    expect([...availableActions('PENDING', 'owner')].sort()).toEqual(['cancel', 'reschedule']);
  });

  it('admin ở trạng thái chờ duyệt thấy thêm duyệt và từ chối', () => {
    expect([...availableActions('PENDING', 'admin')].sort()).toEqual([
      'approve',
      'cancel',
      'reject',
      'reschedule',
    ]);
  });
});

/**
 * Danh sách nút trên giao diện PHẢI khớp với những gì service thực sự cho phép.
 * Lỗi từng gặp: admin mở đơn của giáo viên thì thấy nút "Huỷ đơn" và "Sửa đơn",
 * bấm vào nhận 403 — vì lúc đó chỉ xét vai trò mà bỏ qua quyền sở hữu.
 */
describe('availableActionsFor — có tính quyền sở hữu', () => {
  const chuDon = { isOwner: true, isAdmin: false };
  const adminLa = { isOwner: false, isAdmin: true };
  const adminVaChuDon = { isOwner: true, isAdmin: true };
  const nguoiNgoai = { isOwner: false, isAdmin: false };

  it('admin xem đơn CỦA NGƯỜI KHÁC thì KHÔNG có huỷ và sửa', () => {
    const actions = availableActionsFor('PENDING', adminLa);
    expect(actions).not.toContain('cancel');
    expect(actions).not.toContain('reschedule');
    expect([...actions].sort()).toEqual(['approve', 'reject']);
  });

  it('chủ đơn có huỷ và sửa nhưng KHÔNG có duyệt và từ chối', () => {
    expect([...availableActionsFor('PENDING', chuDon)].sort()).toEqual(['cancel', 'reschedule']);
  });

  it('admin đặt đơn cho chính mình thì có cả hai nhóm', () => {
    expect([...availableActionsFor('PENDING', adminVaChuDon)].sort()).toEqual([
      'approve',
      'cancel',
      'reject',
      'reschedule',
    ]);
  });

  it('người ngoài không có hành động nào', () => {
    for (const status of MOI_TRANG_THAI) {
      expect(availableActionsFor(status, nguoiNgoai), status).toEqual([]);
    }
  });

  it('admin không tự nhận phòng hộ người khác', () => {
    expect(availableActionsFor('APPROVED', adminLa)).not.toContain('checkin');
    expect(availableActionsFor('APPROVED', chuDon)).toContain('checkin');
  });

  it('admin không tự trả phòng hộ người khác', () => {
    expect(availableActionsFor('CHECKED_IN', adminLa)).not.toContain('checkout');
    expect(availableActionsFor('CHECKED_IN', chuDon)).toContain('checkout');
  });

  it('chỉ admin xác nhận nhận lại chìa khoá', () => {
    expect(availableActionsFor('CHECKED_OUT', adminLa)).toEqual(['complete']);
    expect(availableActionsFor('CHECKED_OUT', chuDon)).toEqual([]);
  });

  it.each(TERMINAL_STATUSES)('trạng thái kết thúc %s không còn nút nào cho ai', (status) => {
    expect(availableActionsFor(status, adminVaChuDon)).toEqual([]);
  });
});

describe('Luồng đi đủ vòng đời', () => {
  it('chờ duyệt → đã duyệt → đang dùng → đã trả → hoàn tất', () => {
    let status: RoomBookingStatus = 'PENDING';
    status = assertTransition(status, 'approve');
    expect(status).toBe('APPROVED');
    status = assertTransition(status, 'checkin');
    expect(status).toBe('CHECKED_IN');
    status = assertTransition(status, 'checkout');
    expect(status).toBe('CHECKED_OUT');
    status = assertTransition(status, 'complete');
    expect(status).toBe('COMPLETED');
  });

  it('sửa giờ đơn đã duyệt thì đẩy đơn về hàng chờ duyệt', () => {
    expect(assertTransition('APPROVED', 'reschedule')).toBe('PENDING');
  });

  it('không trả phòng được khi chưa nhận phòng', () => {
    expect(() => assertTransition('APPROVED', 'checkout')).toThrow(ConflictException);
  });

  it('không nhận phòng được khi đơn còn đang chờ duyệt', () => {
    expect(() => assertTransition('PENDING', 'checkin')).toThrow(ConflictException);
  });

  it('không duyệt lại được đơn đã duyệt', () => {
    expect(() => assertTransition('APPROVED', 'approve')).toThrow(ConflictException);
  });

  it('không huỷ được đơn đang sử dụng', () => {
    expect(() => assertTransition('CHECKED_IN', 'cancel')).toThrow(ConflictException);
  });
});
