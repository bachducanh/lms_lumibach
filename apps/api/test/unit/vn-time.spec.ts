import { describe, expect, it } from 'vitest';
import {
  formatHHmm,
  isVnWeekend,
  parseHHmm,
  vnAddDays,
  vnDateKey,
  vnDateLabel,
  vnDateTimeToUtc,
  vnDaysBetween,
  vnMinutesOfDay,
  vnParts,
  vnRangeLabel,
  vnStartOfDay,
  vnStartOfWeek,
  vnTimeLabel,
  vnWeekdayLabel,
} from '@lumibach/types';

describe('Đọc thành phần giờ Việt Nam từ mốc UTC', () => {
  it('cộng đúng 7 tiếng so với UTC', () => {
    // 02:00 UTC = 09:00 giờ Việt Nam cùng ngày
    expect(vnParts(new Date('2026-09-01T02:00:00Z'))).toMatchObject({
      year: 2026,
      month: 9,
      day: 1,
      hour: 9,
      minute: 0,
    });
  });

  it('mốc cuối ngày UTC vẫn thuộc ngày HÔM SAU theo giờ Việt Nam', () => {
    // 18:00 UTC ngày 31/8 = 01:00 ngày 1/9 giờ Việt Nam
    const d = new Date('2026-08-31T18:00:00Z');
    expect(vnDateKey(d)).toBe('2026-09-01');
    expect(vnTimeLabel(d)).toBe('01:00');
  });

  it('mốc đầu ngày UTC vẫn thuộc ngày HÔM TRƯỚC nếu trước 17:00 UTC', () => {
    // 16:59 UTC ngày 1/9 = 23:59 ngày 1/9 giờ Việt Nam
    const d = new Date('2026-09-01T16:59:00Z');
    expect(vnDateKey(d)).toBe('2026-09-01');
    expect(vnTimeLabel(d)).toBe('23:59');
  });

  it('vnMinutesOfDay đếm từ 00:00 giờ Việt Nam', () => {
    expect(vnMinutesOfDay(new Date('2026-09-01T02:30:00Z'))).toBe(9 * 60 + 30);
    expect(vnMinutesOfDay(new Date('2026-08-31T17:00:00Z'))).toBe(0);
  });

  it('không bị ảnh hưởng bởi giờ mùa hè ở bán cầu bắc', () => {
    // Tháng 1 và tháng 7 phải cho cùng độ lệch — Việt Nam không có DST.
    expect(vnParts(new Date('2026-01-15T05:00:00Z')).hour).toBe(12);
    expect(vnParts(new Date('2026-07-15T05:00:00Z')).hour).toBe(12);
  });
});

describe('Dựng mốc UTC từ giờ Việt Nam', () => {
  it('09:00 giờ Việt Nam ngày 01/09/2026 là 02:00 UTC', () => {
    expect(vnDateTimeToUtc('2026-09-01', 9 * 60).toISOString()).toBe('2026-09-01T02:00:00.000Z');
  });

  it('00:00 giờ Việt Nam lùi về 17:00 UTC ngày hôm trước', () => {
    expect(vnDateTimeToUtc('2026-09-01', 0).toISOString()).toBe('2026-08-31T17:00:00.000Z');
  });

  it('đi vòng: dựng rồi đọc lại phải ra đúng giá trị ban đầu', () => {
    for (const phut of [0, 7 * 60, 9 * 60 + 30, 17 * 60 + 30, 23 * 60 + 59]) {
      const d = vnDateTimeToUtc('2026-09-01', phut);
      expect(vnDateKey(d), `phút ${phut}`).toBe('2026-09-01');
      expect(vnMinutesOfDay(d), `phút ${phut}`).toBe(phut);
    }
  });

  it('nhận số phút vượt 1440 để biểu diễn mốc sang ngày hôm sau', () => {
    const d = vnDateTimeToUtc('2026-09-01', 24 * 60);
    expect(vnDateKey(d)).toBe('2026-09-02');
    expect(vnMinutesOfDay(d)).toBe(0);
  });
});

describe('Điều hướng theo ngày và tuần', () => {
  it('vnStartOfDay trả về 00:00 giờ Việt Nam', () => {
    const d = vnStartOfDay(new Date('2026-09-01T15:23:45Z'));
    expect(d.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(vnMinutesOfDay(d)).toBe(0);
  });

  it('vnAddDays giữ nguyên giờ trong ngày', () => {
    const d = vnAddDays(new Date('2026-09-01T02:30:00Z'), 3);
    expect(vnDateKey(d)).toBe('2026-09-04');
    expect(vnTimeLabel(d)).toBe('09:30');
  });

  it('vnAddDays qua ranh giới tháng', () => {
    expect(vnDateKey(vnAddDays(new Date('2026-08-30T02:00:00Z'), 3))).toBe('2026-09-02');
  });

  it.each([
    ['2026-08-31', 'Thứ Hai'],
    ['2026-09-01', 'Thứ Ba'],
    ['2026-09-04', 'Thứ Sáu'],
    ['2026-09-06', 'Chủ nhật'],
  ])('tuần chứa %s (%s) bắt đầu từ Thứ Hai 31/08', (ngay) => {
    const batDau = vnStartOfWeek(vnDateTimeToUtc(ngay, 12 * 60));
    expect(vnDateKey(batDau)).toBe('2026-08-31');
    expect(vnMinutesOfDay(batDau)).toBe(0);
  });

  it('vnDaysBetween đếm theo ngày lịch chứ không theo số giờ chênh lệch', () => {
    // Cách nhau 2 tiếng nhưng đã sang ngày mới theo giờ Việt Nam.
    const a = new Date('2026-08-31T16:00:00Z'); // 23:00 ngày 31/8
    const b = new Date('2026-08-31T18:00:00Z'); // 01:00 ngày 1/9
    expect(vnDaysBetween(a, b)).toBe(1);
  });
});

describe('Cuối tuần theo giờ Việt Nam', () => {
  it.each([
    ['2026-09-05', true], // Thứ bảy
    ['2026-09-06', true], // Chủ nhật
    ['2026-09-07', false], // Thứ hai
    ['2026-09-04', false], // Thứ sáu
  ])('%s → cuối tuần = %s', (ngay, mongDoi) => {
    expect(isVnWeekend(vnDateTimeToUtc(ngay, 10 * 60))).toBe(mongDoi);
  });

  it('mốc UTC thuộc thứ sáu nhưng đã sang thứ bảy giờ Việt Nam thì tính là cuối tuần', () => {
    // 2026-09-04 (thứ sáu) 18:00 UTC = 2026-09-05 (thứ bảy) 01:00 giờ Việt Nam
    expect(isVnWeekend(new Date('2026-09-04T18:00:00Z'))).toBe(true);
  });
});

describe('Nhãn hiển thị', () => {
  it('ngày theo dạng dd/MM/yyyy và giờ 24 tiếng', () => {
    const d = new Date('2026-09-01T09:05:00Z'); // 16:05 giờ Việt Nam
    expect(vnDateLabel(d)).toBe('01/09/2026');
    expect(vnTimeLabel(d)).toBe('16:05');
  });

  it('khung giờ trong cùng ngày rút gọn phần ngày', () => {
    const start = vnDateTimeToUtc('2026-09-01', 9 * 60);
    const end = vnDateTimeToUtc('2026-09-01', 11 * 60);
    expect(vnRangeLabel(start, end)).toBe('09:00 – 11:00 01/09/2026');
  });

  it('khung giờ vắt qua hai ngày ghi đủ cả hai mốc', () => {
    const start = vnDateTimeToUtc('2026-09-01', 23 * 60);
    const end = vnDateTimeToUtc('2026-09-02', 60);
    expect(vnRangeLabel(start, end)).toBe('01/09/2026 23:00 – 02/09/2026 01:00');
  });

  it('nhãn thứ dùng cách viết Việt Nam', () => {
    expect(vnWeekdayLabel(vnDateTimeToUtc('2026-08-31', 600))).toBe('T2');
    expect(vnWeekdayLabel(vnDateTimeToUtc('2026-09-06', 600))).toBe('CN');
  });
});

describe('Chuỗi HH:mm', () => {
  it.each([
    ['07:00', 420],
    ['00:00', 0],
    ['17:30', 1050],
    ['24:00', 1440],
    [' 09:30 ', 570],
  ])('parseHHmm(%s) = %s', (input, mongDoi) => {
    expect(parseHHmm(input)).toBe(mongDoi);
  });

  it.each(['7h', '25:00', '12:60', '', 'abc', '12:5'])('parseHHmm từ chối %s', (input) => {
    expect(parseHHmm(input)).toBeNull();
  });

  it('formatHHmm là phép nghịch của parseHHmm', () => {
    for (const s of ['00:00', '07:30', '17:30', '23:59']) {
      expect(formatHHmm(parseHHmm(s) as number)).toBe(s);
    }
  });
});
