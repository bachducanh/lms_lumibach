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

async function taoThietBi(roomId: string, name: string, totalQuantity: number, code?: string) {
  return testPrisma.equipment.create({
    data: { roomId, name, code: code ?? null, unit: 'máy', totalQuantity },
  });
}

type DonMau = {
  roomId: string;
  userId: string;
  items: { equipmentId: string; quantity: number }[];
  ngay: string;
  tuGio: number;
  denGio: number;
  status?:
    | 'PENDING'
    | 'APPROVED'
    | 'CHECKED_IN'
    | 'CHECKED_OUT'
    | 'COMPLETED'
    | 'NO_SHOW'
    | 'CANCELLED'
    | 'REJECTED';
  department?: string | null;
};

async function taoDon(d: DonMau) {
  return testPrisma.equipmentBooking.create({
    data: {
      roomId: d.roomId,
      userId: d.userId,
      fullName: 'Nguyễn Văn A',
      staffCode: 'GV001',
      department: d.department === undefined ? 'Tổ Toán - Tin' : d.department,
      reason: 'Mượn máy dạy thực hành',
      startAt: vnDateTimeToUtc(d.ngay, d.tuGio * 60),
      endAt: vnDateTimeToUtc(d.ngay, d.denGio * 60),
      status: d.status ?? 'COMPLETED',
      items: { create: d.items },
    },
  });
}

const url = (loai: string, them = '') =>
  `/api/v1/equipment-bookings/reports/${loai}?from=${encodeURIComponent(TU)}&to=${encodeURIComponent(DEN)}${them}`;

describe('Báo cáo thiết bị — phân quyền', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['usage', 'no-show'])('403 — giáo viên không xem được báo cáo %s', async (loai) => {
    const gv = await loginAs('TEACHER');
    const res = await request(app.getHttpServer()).get(url(loai)).set('Cookie', gv.cookie);
    expect(res.status).toBe(403);
  });

  it('403 — giáo viên không xem được danh sách đang mượn', async () => {
    const gv = await loginAs('TEACHER');
    const res = await request(app.getHttpServer())
      .get('/api/v1/equipment-bookings/reports/outstanding')
      .set('Cookie', gv.cookie);
    expect(res.status).toBe(403);
  });

  it('401 — chưa đăng nhập', async () => {
    expect((await request(app.getHttpServer()).get(url('usage'))).status).toBe(401);
  });

  /** Đường dẫn báo cáo không được rơi vào tham số `:id` của controller đơn mượn. */
  it('không bị nuốt bởi route chi tiết đơn', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toBeDefined();
  });
});

describe('Báo cáo tần suất mượn thiết bị', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('gom theo thiết bị: mỗi dòng thiết bị một nhóm, tổng đơn vẫn đếm một lần', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom({ name: 'Phòng Tin học 1' });
    const may = await taoThietBi(room.id, 'MacBook', 10, 'MB-01');
    const chieu = await taoThietBi(room.id, 'Máy chiếu', 3);

    // Một đơn mượn CẢ HAI loại thiết bị.
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      items: [
        { equipmentId: may.id, quantity: 2 },
        { equipmentId: chieu.id, quantity: 1 },
      ],
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 10,
      items: [{ equipmentId: may.id, quantity: 3 }],
    });

    const res = await request(app.getHttpServer())
      .get(url('usage', '&groupBy=equipment'))
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    // Hai đơn thật, dù cộng các dòng lại thì thành ba.
    expect(res.body.data.total).toEqual({ bookingCount: 2, itemQuantity: 6, totalHours: 3 });

    const rows = res.body.data.rows;
    expect(rows[0]).toMatchObject({
      label: 'MacBook (MB-01) · Phòng Tin học 1',
      bookingCount: 2,
      itemQuantity: 5,
      totalHours: 3,
    });
    expect(rows[1]).toMatchObject({
      label: 'Máy chiếu · Phòng Tin học 1',
      bookingCount: 1,
      itemQuantity: 1,
      totalHours: 2,
    });
  });

  it('gom theo tổ chuyên môn: đơn đếm một lần dù mượn nhiều loại thiết bị', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const chieu = await taoThietBi(room.id, 'Máy chiếu', 3);

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      department: 'Tổ Toán - Tin',
      items: [
        { equipmentId: may.id, quantity: 2 },
        { equipmentId: chieu.id, quantity: 1 },
      ],
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 11,
      department: null,
      items: [{ equipmentId: may.id, quantity: 1 }],
    });

    const res = await request(app.getHttpServer())
      .get(url('usage', '&groupBy=department'))
      .set('Cookie', admin.cookie);

    const rows = res.body.data.rows;
    expect(rows.map((r: { label: string }) => r.label).sort()).toEqual([
      '(không ghi tổ)',
      'Tổ Toán - Tin',
    ]);
    expect(rows.find((r: { label: string }) => r.label === 'Tổ Toán - Tin')).toMatchObject({
      bookingCount: 1,
      itemQuantity: 3,
    });
  });

  /** Đơn lúc 00:30 ngày 01/10 giờ VN là 17:30 ngày 30/09 UTC. */
  it('gom theo tháng dùng GIỜ VIỆT NAM, không phải UTC', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-10-01',
      tuGio: 0.5,
      denGio: 2,
      items: [{ equipmentId: may.id, quantity: 1 }],
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-15',
      tuGio: 9,
      denGio: 11,
      items: [{ equipmentId: may.id, quantity: 1 }],
    });

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
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const item = [{ equipmentId: may.id, quantity: 1 }];

    for (const [ngay, status] of [
      ['2026-09-01', 'COMPLETED'],
      ['2026-09-02', 'NO_SHOW'],
      ['2026-09-03', 'CANCELLED'],
      ['2026-09-04', 'REJECTED'],
    ] as const) {
      await taoDon({
        roomId: room.id,
        userId: gv.user.id,
        ngay,
        tuGio: 9,
        denGio: 10,
        status,
        items: item,
      });
    }

    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', admin.cookie);

    expect(res.body.data.rows[0]).toMatchObject({
      bookingCount: 4,
      completedCount: 1,
      noShowCount: 1,
      cancelledCount: 1,
      rejectedCount: 1,
    });
  });

  it('lọc theo một phòng quản lý cụ thể', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();
    const mayA = await taoThietBi(phongA.id, 'MacBook', 10);
    const mayB = await taoThietBi(phongB.id, 'MacBook', 10);

    await taoDon({
      roomId: phongA.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      items: [{ equipmentId: mayA.id, quantity: 1 }],
    });
    await taoDon({
      roomId: phongB.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 13,
      denGio: 15,
      items: [{ equipmentId: mayB.id, quantity: 1 }],
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
    const may = await taoThietBi(room.id, 'MacBook', 10);

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-08-15',
      tuGio: 9,
      denGio: 11,
      items: [{ equipmentId: may.id, quantity: 1 }],
    });

    const res = await request(app.getHttpServer()).get(url('usage')).set('Cookie', admin.cookie);

    expect(res.body.data.total.bookingCount).toBe(0);
    expect(res.body.data.rows).toEqual([]);
  });

  it('400 — khoảng quá rộng bị chặn kèm hướng dẫn', async () => {
    const admin = await loginAs('ADMIN');
    const xa = vnDateTimeToUtc('2030-01-01', 0).toISOString();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/equipment-bookings/reports/usage?from=${encodeURIComponent(TU)}&to=${encodeURIComponent(xa)}`
      )
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/tối đa 400 ngày/);
  });
});

describe('Báo cáo thiết bị đang mượn và quá hạn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cộng số lượng đang ngoài kho và tách riêng phần quá hạn', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom({ name: 'Phòng Tin học 1' });
    const may = await taoThietBi(room.id, 'MacBook', 10, 'MB-01');

    // Đơn quá hạn: khung giờ đã qua từ lâu mà vẫn đang giữ máy.
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      status: 'CHECKED_IN',
      items: [{ equipmentId: may.id, quantity: 2 }],
    });
    // Đơn còn trong hạn: khung giờ nằm ở tương lai xa.
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2099-09-01',
      tuGio: 9,
      denGio: 11,
      status: 'CHECKED_IN',
      items: [{ equipmentId: may.id, quantity: 3 }],
    });
    // Đơn đã hoàn tất thì không còn ngoài kho.
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 11,
      status: 'COMPLETED',
      items: [{ equipmentId: may.id, quantity: 4 }],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/equipment-bookings/reports/outstanding')
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.bookings).toHaveLength(2);
    expect(res.body.data.byEquipment).toHaveLength(1);
    expect(res.body.data.byEquipment[0]).toMatchObject({
      equipmentName: 'MacBook',
      equipmentCode: 'MB-01',
      roomName: 'Phòng Tin học 1',
      totalQuantity: 10,
      onLoanQuantity: 5,
      overdueQuantity: 2,
    });

    // Đơn quá hạn lâu nhất đứng đầu và có số giờ trễ dương.
    expect(res.body.data.bookings[0].overdueHours).toBeGreaterThan(0);
    expect(res.body.data.bookings[1].overdueHours).toBe(0);
  });

  it('đơn đã báo trả nhưng chưa xác nhận vẫn tính là ngoài kho', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      status: 'CHECKED_OUT',
      items: [{ equipmentId: may.id, quantity: 2 }],
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/equipment-bookings/reports/outstanding')
      .set('Cookie', admin.cookie);

    expect(res.body.data.bookings).toHaveLength(1);
    expect(res.body.data.bookings[0].status).toBe('CHECKED_OUT');
    expect(res.body.data.byEquipment[0].onLoanQuantity).toBe(2);
  });

  it('không còn đơn nào đang giữ thì trả về rỗng', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer())
      .get('/api/v1/equipment-bookings/reports/outstanding')
      .set('Cookie', admin.cookie);

    expect(res.body.data.bookings).toEqual([]);
    expect(res.body.data.byEquipment).toEqual([]);
  });
});

describe('Báo cáo mượn thiết bị không đến nhận', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chỉ liệt kê đơn NO_SHOW, kèm thiết bị đã đăng ký', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom({ name: 'Phòng Tin học 1' });
    const may = await taoThietBi(room.id, 'MacBook', 10);

    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-01',
      tuGio: 9,
      denGio: 11,
      status: 'NO_SHOW',
      items: [{ equipmentId: may.id, quantity: 2 }],
    });
    await taoDon({
      roomId: room.id,
      userId: gv.user.id,
      ngay: '2026-09-02',
      tuGio: 9,
      denGio: 11,
      status: 'COMPLETED',
      items: [{ equipmentId: may.id, quantity: 1 }],
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
    expect(res.body.data[0].items).toEqual([
      expect.objectContaining({ equipmentName: 'MacBook', quantity: 2, unit: 'máy' }),
    ]);
  });

  it('trả về rỗng khi không có đơn nào', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer()).get(url('no-show')).set('Cookie', admin.cookie);
    expect(res.body.data).toEqual([]);
  });
});
