import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vnDateTimeToUtc } from '@lumibach/types';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestUser } from '../factories';
import { testPrisma } from '../db';

async function loginAs(role: 'ADMIN' | 'TEACHER' | 'STUDENT') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

/** Khoảng bao trọn dữ liệu mẫu bên dưới (tháng 9 và 10 năm 2026). */
const TU = vnDateTimeToUtc('2026-09-01', 0).toISOString();
const DEN = vnDateTimeToUtc('2026-11-01', 0).toISOString();

type DonMau = {
  roomId: string;
  userId: string;
  ngay: string;
  tuGio: number;
  denGio: number;
  status?: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'REJECTED';
  department?: string | null;
  hasDiscrepancy?: boolean;
};

async function taoDon(d: DonMau) {
  return testPrisma.roomBooking.create({
    data: {
      roomId: d.roomId,
      userId: d.userId,
      fullName: 'Nguyễn Văn A',
      staffCode: 'GV001',
      department: d.department === undefined ? 'Tổ Toán - Tin' : d.department,
      reason: 'Dạy thực hành',
      startAt: vnDateTimeToUtc(d.ngay, d.tuGio * 60),
      endAt: vnDateTimeToUtc(d.ngay, d.denGio * 60),
      status: d.status ?? 'COMPLETED',
      hasDiscrepancy: d.hasDiscrepancy ?? false,
    },
  });
}

const url = (loai: string, them = '') =>
  `/api/v1/rooms/reports/${loai}?from=${encodeURIComponent(TU)}&to=${encodeURIComponent(DEN)}${them}`;

describe('Báo cáo — phân quyền', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['usage', 'no-show', 'discrepancies'])(
    '403 — giáo viên không xem được báo cáo %s',
    async (loai) => {
      const gv = await loginAs('TEACHER');
      const res = await request(app.getHttpServer()).get(url(loai)).set('Cookie', gv.cookie);
      expect(res.status).toBe(403);
    }
  );

  it('403 — học sinh cũng bị chặn', async () => {
    const hs = await loginAs('STUDENT');
    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', hs.cookie);
    expect(res.status).toBe(403);
  });

  it('401 — chưa đăng nhập', async () => {
    expect((await request(app.getHttpServer()).get(url('usage'))).status).toBe(401);
  });
});

describe('Báo cáo tần suất sử dụng', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('gom theo phòng, kèm tổng số giờ', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const phongA = await createTestRoom({ name: 'Phòng Tin học 1' });
    const phongB = await createTestRoom({ name: 'Phòng Tin học 2' });

    await taoDon({
      roomId: phongA.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
    });
    await taoDon({
      roomId: phongA.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 12,
    });
    await taoDon({
      roomId: phongB.id,
      userId: gv.user.id,
      ngay: '2026-09-03',
      tuGio: 9,
      denGio: 10,
    });

    const res = await request(app.getHttpServer())
      .get(url('usage', '&groupBy=room'))
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toEqual({ bookingCount: 3, totalHours: 6 });

    // Sắp giảm dần theo số đơn: phòng 1 (2 đơn) đứng trước phòng 2 (1 đơn).
    const rows = res.body.data.rows;
    expect(rows[0]).toMatchObject({ label: 'Phòng Tin học 1', bookingCount: 2, totalHours: 5 });
    expect(rows[1]).toMatchObject({ label: 'Phòng Tin học 2', bookingCount: 1, totalHours: 1 });
  });

  it('gom theo tổ chuyên môn, đơn không ghi tổ vào nhóm riêng', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      department: 'Tổ Toán - Tin',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 11,
      department: 'Tổ Vật lý',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-03',
      tuGio: 9,
      denGio: 11,
      department: null,
    });

    const res = await request(app.getHttpServer())
      .get(url('usage', '&groupBy=department'))
      .set('Cookie', admin.cookie);

    const nhan = res.body.data.rows.map((r: { label: string }) => r.label).sort();
    expect(nhan).toEqual(['(không ghi tổ)', 'Tổ Toán - Tin', 'Tổ Vật lý']);
  });

  /**
   * Ranh giới dễ sai nhất của báo cáo: đơn lúc 00:30 ngày 01/10 giờ Việt Nam là
   * 17:30 ngày 30/09 UTC. Gom theo UTC sẽ xếp nhầm sang tháng 9.
   */
  it('gom theo tháng dùng GIỜ VIỆT NAM, không phải UTC', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();

    // 00:30 ngày 01/10 giờ VN — vẫn là 30/09 nếu tính theo UTC.
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-10-01',
      tuGio: 0.5,
      denGio: 2,
    });
    await taoDon({ roomId: room.id, userId: gv.user.id, ngay: '2026-09-15', tuGio: 9, denGio: 11 });

    const res = await request(app.getHttpServer())
      .get(url('usage', '&groupBy=month'))
      .set('Cookie', admin.cookie);

    const rows = res.body.data.rows;
    expect(rows.map((r: { key: string }) => r.key)).toEqual(['2026-09', '2026-10']);
    expect(rows[1]).toMatchObject({ label: 'Tháng 10/2026', bookingCount: 1 });
  });

  it('đếm riêng từng trạng thái', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 10,
      status: 'COMPLETED',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 10,
      status: 'NO_SHOW',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-03',
      tuGio: 9,
      denGio: 10,
      status: 'CANCELLED',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-04',
      tuGio: 9,
      denGio: 10,
      status: 'REJECTED',
    });

    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', admin.cookie);

    expect(res.body.data.rows[0]).toMatchObject({
      bookingCount: 4,
      completedCount: 1,
      noShowCount: 1,
      cancelledCount: 1,
      rejectedCount: 1,
    });
  });

  it('lọc theo một phòng cụ thể', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();
    await taoDon({
      roomId: phongA.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
    });
    await taoDon({
      roomId: phongB.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 13,
      denGio: 15,
    });

    const res = await request(app.getHttpServer())
      .get(url('usage', `&roomId=${phongA.id}`))
      .set('Cookie', admin.cookie);

    expect(res.body.data.total.bookingCount).toBe(1);
  });

  it('đơn ngoài khoảng thời gian không được tính', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoDon({ roomId: room.id, userId: gv.user.id, ngay: '2026-08-15', tuGio: 9, denGio: 11 });
    await taoDon({ roomId: room.id, userId: gv.user.id, ngay: '2026-12-15', tuGio: 9, denGio: 11 });

    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', admin.cookie);

    expect(res.body.data.total.bookingCount).toBe(0);
    expect(res.body.data.rows).toEqual([]);
  });

  it('400 — khoảng thời gian ngược', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/rooms/reports/usage?from=${encodeURIComponent(DEN)}&to=${encodeURIComponent(TU)}`
      )
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(400);
  });

  it('400 — khoảng quá rộng bị chặn kèm hướng dẫn', async () => {
    const admin = await loginAs('ADMIN');
    const xa = vnDateTimeToUtc('2030-01-01', 0).toISOString();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/rooms/reports/usage?from=${encodeURIComponent(TU)}&to=${encodeURIComponent(xa)}`
      )
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/tối đa 400 ngày/);
  });
});

describe('Báo cáo không đến nhận', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chỉ liệt kê đơn NO_SHOW, kèm đủ thông tin liên hệ', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom({ name: 'Phòng Tin học 1' });

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      status: 'NO_SHOW',
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 11,
      status: 'COMPLETED',
    });

    const res = await request(app.getHttpServer()).get(url('no-show')).set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      roomName: 'Phòng Tin học 1',
      fullName: 'Nguyễn Văn A',
      staffCode: 'GV001',
      department: 'Tổ Toán - Tin',
    });
  });

  it('trả về rỗng khi không có đơn nào', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer()).get(url('no-show')).set('Cookie', admin.cookie);
    expect(res.body.data).toEqual([]);
  });
});

describe('Báo cáo bàn giao lệch số liệu', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Đơn đã bàn giao đủ hai lượt, với số liệu do test chỉ định. */
  async function taoDonCoBanGiao(
    roomId: string,
    userId: string,
    luocNhan: Record<string, number>,
    luocTra: Record<string, number>
  ) {
    const don = await taoDon({
      roomId,
      userId,
      ngay: '2026-09-10',
      tuGio: 9,
      denGio: 11,
      hasDiscrepancy: true,
    });
    for (const [type, values] of [
      ['CHECKIN', luocNhan],
      ['CHECKOUT', luocTra],
    ] as const) {
      await testPrisma.handover.create({
        data: {
          bookableType: 'ROOM',
          type,
          roomBookingId: don.id,
          performedById: userId,
          conditionNote: type === 'CHECKIN' ? 'Nhận phòng đủ máy' : 'Trả phòng thiếu máy',
          fieldValues: values,
        },
      });
    }
    return don;
  }

  it('nêu rõ thiếu trường nào và thiếu bao nhiêu', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom({ name: 'Phòng Tin học 1' });
    await testPrisma.handoverField.create({
      data: { roomId: null, key: 'so_may', label: 'Số máy', dataType: 'NUMBER', appliesTo: 'BOTH' },
    });
    await testPrisma.handoverField.create({
      data: {
        roomId: null,
        key: 'so_chuot',
        label: 'Số chuột',
        dataType: 'NUMBER',
        appliesTo: 'BOTH',
      },
    });

    await taoDonCoBanGiao(
      room.id,
      gv.user.id,
      { so_may: 30, so_chuot: 15 },
      { so_may: 30, so_chuot: 12 }
    );

    const res = await request(app.getHttpServer())
      .get(url('discrepancies'))
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].shortfalls).toHaveLength(1);
    expect(res.body.data[0].shortfalls[0]).toMatchObject({
      label: 'Số chuột',
      checkinValue: 15,
      checkoutValue: 12,
      shortfall: 3,
    });
    expect(res.body.data[0].checkoutAt).not.toBeNull();
  });

  it('trả THỪA thì không vào báo cáo', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await testPrisma.handoverField.create({
      data: { roomId: null, key: 'so_may', label: 'Số máy', dataType: 'NUMBER', appliesTo: 'BOTH' },
    });

    // Cờ bị đặt sai (hoặc do sửa tay) nhưng thực tế trả thừa — báo cáo tính lại
    // từ dữ liệu bàn giao nên vẫn loại đơn này ra.
    await taoDonCoBanGiao(room.id, gv.user.id, { so_may: 28 }, { so_may: 30 });

    const res = await request(app.getHttpServer())
      .get(url('discrepancies'))
      .set('Cookie', admin.cookie);

    expect(res.body.data).toEqual([]);
  });

  it('đơn chưa trả phòng thì chưa vào báo cáo', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const don = await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-10',
      tuGio: 9,
      denGio: 11,
      hasDiscrepancy: true,
    });
    await testPrisma.handover.create({
      data: {
        bookableType: 'ROOM',
        type: 'CHECKIN',
        roomBookingId: don.id,
        performedById: gv.user.id,
        conditionNote: 'Mới nhận phòng',
        fieldValues: { so_may: 30 },
      },
    });

    const res = await request(app.getHttpServer())
      .get(url('discrepancies'))
      .set('Cookie', admin.cookie);

    expect(res.body.data).toEqual([]);
  });
});
