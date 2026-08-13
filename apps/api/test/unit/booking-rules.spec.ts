import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_BOOKING_SETTING,
  vnDateTimeToUtc,
  type RoomBookingSettingDto,
} from '@lumibach/types';
import {
  assertBookingWindow,
  canCheckInNow,
  checkInWindowMessage,
  validateBookingWindow,
} from '@/modules/rooms/booking-rules';

const SETTING: RoomBookingSettingDto = { ...DEFAULT_ROOM_BOOKING_SETTING, isDefault: true };

// Thứ ba 01/09/2026, giữa tuần, nằm gọn trong giờ mở cửa mặc định 07:00–17:30.
const NGAY = '2026-09-01';
const THU_BAY = '2026-09-05';
const gio = (h: number, m = 0, ngay = NGAY) => vnDateTimeToUtc(ngay, h * 60 + m);

/** "Bây giờ" cố định: 08:00 giờ Việt Nam ngày 31/08/2026 (thứ hai). */
const NOW = vnDateTimeToUtc('2026-08-31', 8 * 60);

const ctx = (
  over: Partial<{ setting: RoomBookingSettingDto; now: Date; isAdmin: boolean }> = {}
) => ({
  setting: over.setting ?? SETTING,
  now: over.now ?? NOW,
  isAdmin: over.isAdmin ?? false,
});

const codes = (start: Date, end: Date, over?: Parameters<typeof ctx>[0]) =>
  validateBookingWindow({ startAt: start, endAt: end }, ctx(over)).map((e) => e.code);

describe('Khung giờ hợp lệ', () => {
  it('09:00–11:00 giữa tuần trong giờ mở cửa thì không có lỗi nào', () => {
    expect(codes(gio(9), gio(11))).toEqual([]);
  });

  it('đúng mốc mở cửa và đóng cửa vẫn hợp lệ', () => {
    expect(codes(gio(7), gio(9))).toEqual([]);
    expect(codes(gio(15, 30), gio(17, 30))).toEqual([]);
  });

  it('thời lượng tối thiểu và tối đa đúng biên đều hợp lệ', () => {
    expect(codes(gio(9), gio(9, 30))).toEqual([]); // 30 phút = min
    expect(codes(gio(9), gio(14))).toEqual([]); // 300 phút = max
  });
});

describe('Kiểm tra cơ bản', () => {
  it('giờ kết thúc bằng giờ bắt đầu bị chặn', () => {
    expect(codes(gio(9), gio(9))).toEqual(['END_BEFORE_START']);
  });

  it('giờ kết thúc trước giờ bắt đầu bị chặn', () => {
    expect(codes(gio(11), gio(9))).toEqual(['END_BEFORE_START']);
  });

  it('ngày không hợp lệ bị chặn ngay, không chạy tiếp các kiểm tra khác', () => {
    expect(codes(new Date('bậy bạ'), gio(9))).toEqual(['INVALID_DATE']);
  });

  it('đơn vắt qua hai ngày bị chặn', () => {
    const start = vnDateTimeToUtc(NGAY, 23 * 60);
    const end = vnDateTimeToUtc('2026-09-02', 60);
    expect(codes(start, end)).toContain('CROSS_DAY');
  });
});

describe('Giờ mở cửa', () => {
  it('bắt đầu trước giờ mở cửa bị chặn', () => {
    expect(codes(gio(6), gio(8))).toContain('OUTSIDE_OPEN_HOURS');
  });

  it('kết thúc sau giờ đóng cửa bị chặn', () => {
    expect(codes(gio(16), gio(18))).toContain('OUTSIDE_OPEN_HOURS');
  });

  it('theo giờ Việt Nam chứ không phải UTC', () => {
    // 01:00 UTC = 08:00 giờ Việt Nam → nằm TRONG giờ mở cửa.
    const start = new Date('2026-09-01T01:00:00Z');
    const end = new Date('2026-09-01T03:00:00Z');
    expect(codes(start, end)).not.toContain('OUTSIDE_OPEN_HOURS');
  });

  it('cấu hình giờ hỏng thì bỏ qua ràng buộc này thay vì chặn mọi đơn', () => {
    const setting = { ...SETTING, openTime: 'bậy', closeTime: '17:30' };
    expect(codes(gio(9), gio(11), { setting })).not.toContain('OUTSIDE_OPEN_HOURS');
  });

  it('giờ mở cửa lớn hơn giờ đóng cửa cũng bị coi là cấu hình hỏng', () => {
    const setting = { ...SETTING, openTime: '18:00', closeTime: '07:00' };
    expect(codes(gio(9), gio(11), { setting })).not.toContain('OUTSIDE_OPEN_HOURS');
  });
});

describe('Thời lượng', () => {
  it('ngắn hơn mức tối thiểu bị chặn', () => {
    expect(codes(gio(9), gio(9, 15))).toContain('TOO_SHORT');
  });

  it('dài hơn mức tối đa bị chặn', () => {
    const setting = { ...SETTING, maxDurationMinutes: 120 };
    expect(codes(gio(9), gio(13), { setting })).toContain('TOO_LONG');
  });

  it('thông báo đổi phút sang giờ cho dễ đọc', () => {
    const setting = { ...SETTING, maxDurationMinutes: 90 };
    const errors = validateBookingWindow({ startAt: gio(9), endAt: gio(13) }, ctx({ setting }));
    expect(errors.find((e) => e.code === 'TOO_LONG')?.message).toContain('1 tiếng 30 phút');
  });
});

describe('Bước slot', () => {
  it('giờ lẻ không rơi vào mốc 30 phút bị chặn', () => {
    expect(codes(gio(9, 10), gio(11))).toContain('NOT_ON_SLOT');
    expect(codes(gio(9), gio(10, 45))).toContain('NOT_ON_SLOT');
  });

  it('đổi bước sang 15 phút thì 09:15 hợp lệ', () => {
    const setting = { ...SETTING, slotStepMinutes: 15 };
    expect(codes(gio(9, 15), gio(10, 45), { setting })).toEqual([]);
  });
});

describe('Cuối tuần', () => {
  it('thứ bảy đặt được theo cấu hình mặc định', () => {
    expect(codes(gio(9, 0, THU_BAY), gio(11, 0, THU_BAY))).toEqual([]);
  });

  it('tắt allowWeekend thì thứ bảy bị chặn', () => {
    const setting = { ...SETTING, allowWeekend: false };
    expect(codes(gio(9, 0, THU_BAY), gio(11, 0, THU_BAY), { setting })).toContain('WEEKEND');
  });

  it('bật allowWeekend rõ ràng thì đặt được', () => {
    const setting = { ...SETTING, allowWeekend: true };
    expect(codes(gio(9, 0, THU_BAY), gio(11, 0, THU_BAY), { setting })).toEqual([]);
  });
});

describe('Giới hạn thời điểm', () => {
  it('khung giờ đã qua bị chặn', () => {
    const now = vnDateTimeToUtc(NGAY, 12 * 60);
    expect(codes(gio(9), gio(11), { now })).toContain('IN_THE_PAST');
  });

  it('đặt trước quá số ngày cho phép bị chặn', () => {
    const setting = { ...SETTING, maxAdvanceDays: 7 };
    const xa = vnDateTimeToUtc('2026-10-01', 9 * 60);
    const xaEnd = vnDateTimeToUtc('2026-10-01', 11 * 60);
    expect(codes(xa, xaEnd, { setting })).toContain('TOO_FAR_AHEAD');
  });

  it('đúng biên số ngày đặt trước vẫn hợp lệ', () => {
    const setting = { ...SETTING, maxAdvanceDays: 1 };
    // NOW là 31/08, đặt ngày 01/09 → cách 1 ngày, đúng biên.
    expect(codes(gio(9), gio(11), { setting })).toEqual([]);
  });
});

describe('Admin được bỏ qua ràng buộc lịch', () => {
  it('admin đặt ngoài giờ mở cửa, cuối tuần, quá khứ đều qua', () => {
    const now = vnDateTimeToUtc('2026-12-01', 8 * 60);
    expect(codes(gio(5, 0, THU_BAY), gio(23, 0, THU_BAY), { now, isAdmin: true })).toEqual([]);
  });

  it('nhưng admin vẫn không phá được kiểm tra cơ bản', () => {
    expect(codes(gio(11), gio(9), { isAdmin: true })).toEqual(['END_BEFORE_START']);

    const start = vnDateTimeToUtc(NGAY, 23 * 60);
    const end = vnDateTimeToUtc('2026-09-02', 60);
    expect(codes(start, end, { isAdmin: true })).toContain('CROSS_DAY');
  });
});

describe('assertBookingWindow', () => {
  it('không ném gì khi khung giờ hợp lệ', () => {
    expect(() => assertBookingWindow({ startAt: gio(9), endAt: gio(11) }, ctx())).not.toThrow();
  });

  it('ném BadRequestException gộp mọi thông báo lỗi', () => {
    expect(() => assertBookingWindow({ startAt: gio(6), endAt: gio(6, 10) }, ctx())).toThrow(
      BadRequestException
    );
  });

  it('giữ lại danh sách mã lỗi trong details để giao diện dùng', () => {
    try {
      assertBookingWindow({ startAt: gio(6), endAt: gio(6, 10) }, ctx());
      expect.unreachable('đáng ra phải ném lỗi');
    } catch (err) {
      const res = (err as BadRequestException).getResponse() as { details: { code: string }[] };
      expect(res.details.map((d) => d.code)).toContain('TOO_SHORT');
      expect(res.details.map((d) => d.code)).toContain('OUTSIDE_OPEN_HOURS');
    }
  });
});

describe('Cửa sổ nhận phòng', () => {
  const window = { startAt: gio(9), endAt: gio(11) };

  it('trong khoảng 15 phút trước giờ bắt đầu thì nhận được', () => {
    expect(canCheckInNow(window, SETTING, gio(8, 45))).toBe(true);
    expect(canCheckInNow(window, SETTING, gio(9))).toBe(true);
  });

  it('sớm hơn 15 phút thì chưa nhận được', () => {
    expect(canCheckInNow(window, SETTING, gio(8, 44))).toBe(false);
    expect(checkInWindowMessage(window, SETTING, gio(8, 44))).toContain('15 phút');
  });

  it('nhận muộn trong lúc đang diễn ra vẫn được', () => {
    expect(canCheckInNow(window, SETTING, gio(10, 30))).toBe(true);
  });

  it('quá giờ kết thúc thì phải nhờ admin', () => {
    expect(canCheckInNow(window, SETTING, gio(11, 1))).toBe(false);
    expect(checkInWindowMessage(window, SETTING, gio(11, 1))).toContain('Quản trị viên');
  });

  it('cửa sổ nhận phòng đổi theo cấu hình', () => {
    const setting = { ...SETTING, checkinWindowMinutes: 60 };
    expect(canCheckInNow(window, setting, gio(8, 15))).toBe(true);
  });
});
