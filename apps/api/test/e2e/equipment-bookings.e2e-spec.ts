import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vnAddDays, vnDateKey, vnDateTimeToUtc } from '@lumibach/types';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestUser } from '../factories';
import { testPrisma } from '../db';

async function loginAs(role: 'ADMIN' | 'TEACHER' | 'TA' | 'STUDENT') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

/** Ngày làm việc trong tương lai, tránh cuối tuần và tránh khung giờ đã qua. */
function ngayLamViecSapToi(): string {
  let d = vnAddDays(new Date(), 3);
  for (let i = 0; i < 7; i++) {
    const thu = new Date(vnDateTimeToUtc(vnDateKey(d), 12 * 60)).getUTCDay();
    if (thu !== 0 && thu !== 6) break;
    d = vnAddDays(d, 1);
  }
  return vnDateKey(d);
}

const NGAY = ngayLamViecSapToi();
const gio = (h: number) => vnDateTimeToUtc(NGAY, h * 60).toISOString();

async function taoThietBi(roomId: string, name: string, totalQuantity: number) {
  return testPrisma.equipment.create({
    data: { roomId, name, unit: 'máy', totalQuantity },
  });
}

const donMau = (
  roomId: string,
  items: { equipmentId: string; quantity: number }[],
  h1: number,
  h2: number
) => ({
  roomId,
  fullName: 'Nguyễn Văn A',
  staffCode: 'GV001',
  department: 'Tổ Toán - Tin',
  reason: 'Mượn máy dạy thực hành lớp 10A1',
  startAt: gio(h1),
  endAt: gio(h2),
  items,
});

describe('Mượn thiết bị — phân quyền', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('403 — học sinh không tạo và không xem được', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const hs = await loginAs('STUDENT');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', hs.cookie)
      .send(donMau(room.id, [{ equipmentId: may.id, quantity: 2 }], 9, 11));
    const xem = await request(app.getHttpServer())
      .get(`/api/v1/equipment-bookings?from=${gio(7)}&to=${gio(18)}`)
      .set('Cookie', hs.cookie);

    expect(tao.status).toBe(403);
    expect(xem.status).toBe(403);
  });

  it('403 — giáo viên không duyệt được, không vào được hàng chờ', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, [{ equipmentId: may.id, quantity: 2 }], 9, 11));

    const duyet = await request(app.getHttpServer())
      .post(`/api/v1/equipment-bookings/${tao.body.data.id}/approve`)
      .set('Cookie', gv.cookie);
    const hangCho = await request(app.getHttpServer())
      .get('/api/v1/equipment-bookings/pending')
      .set('Cookie', gv.cookie);

    expect(tao.status).toBe(201);
    expect(duyet.status).toBe(403);
    expect(hangCho.status).toBe(403);
  });

  it('403 — người khác không sửa và không huỷ đơn của mình', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const chuDon = await loginAs('TEACHER');
    const nguoiLa = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', chuDon.cookie)
      .send(donMau(room.id, [{ equipmentId: may.id, quantity: 2 }], 9, 11));

    const sua = await request(app.getHttpServer())
      .patch(`/api/v1/equipment-bookings/${tao.body.data.id}`)
      .set('Cookie', nguoiLa.cookie)
      .send({ reason: 'Người lạ thử sửa đơn của người khác' });
    const huy = await request(app.getHttpServer())
      .post(`/api/v1/equipment-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', nguoiLa.cookie);

    expect(sua.status).toBe(403);
    expect(huy.status).toBe(403);
  });
});

describe('Mượn thiết bị — ràng buộc số lượng', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function dat(
    cookie: string,
    roomId: string,
    equipmentId: string,
    quantity: number,
    h1: number,
    h2: number
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, [{ equipmentId, quantity }], h1, h2));
  }

  /**
   * Đúng tình huống trong tiêu chí nghiệm thu:
   * "Thiết bị có 10 máy: đã duyệt 8 máy trong 9:00–11:00 → người khác đặt 3 máy
   *  lúc 10:00–12:00 bị chặn, đặt 2 máy thì được."
   */
  it('10 máy, đã giữ 8 trong 9–11: đặt 3 lúc 10–12 BỊ CHẶN, đặt 2 thì ĐƯỢC', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const admin = await loginAs('ADMIN');
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const donA = await dat(nguoiA.cookie, room.id, may.id, 8, 9, 11);
    expect(donA.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/api/v1/equipment-bookings/${donA.body.data.id}/approve`)
      .set('Cookie', admin.cookie);

    const ba = await dat(nguoiB.cookie, room.id, may.id, 3, 10, 12);
    expect(ba.status).toBe(409);
    expect(ba.body.error.message).toMatch(/cần 3, còn 2/);

    const hai = await dat(nguoiB.cookie, room.id, may.id, 2, 10, 12);
    expect(hai.status).toBe(201);
  });

  it('đơn CHỜ DUYỆT cũng giữ chỗ, không phải chỉ đơn đã duyệt', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    await dat(nguoiA.cookie, room.id, may.id, 9, 9, 11);
    const res = await dat(nguoiB.cookie, room.id, may.id, 2, 9, 11);

    expect(res.status).toBe(409);
  });

  it('khung giờ KHÔNG giao nhau thì mượn lại toàn bộ được', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const sang = await dat(gv.cookie, room.id, may.id, 10, 9, 11);
    const chieu = await dat(gv.cookie, room.id, may.id, 10, 13, 15);

    expect(sang.status).toBe(201);
    expect(chieu.status).toBe(201);
  });

  it('khung giờ liền kề không tính là giao nhau', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const truoc = await dat(gv.cookie, room.id, may.id, 10, 9, 11);
    const sau = await dat(gv.cookie, room.id, may.id, 10, 11, 13);

    expect(truoc.status).toBe(201);
    expect(sau.status).toBe(201);
  });

  it('huỷ đơn thì trả lại số lượng ngay', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const donA = await dat(nguoiA.cookie, room.id, may.id, 10, 9, 11);
    const biChan = await dat(nguoiB.cookie, room.id, may.id, 1, 9, 11);
    expect(biChan.status).toBe(409);

    await request(app.getHttpServer())
      .post(`/api/v1/equipment-bookings/${donA.body.data.id}/cancel`)
      .set('Cookie', nguoiA.cookie);

    const sauKhiHuy = await dat(nguoiB.cookie, room.id, may.id, 10, 9, 11);
    expect(sauKhiHuy.status).toBe(201);
  });

  it('từ chối đơn cũng trả lại số lượng', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const admin = await loginAs('ADMIN');
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const donA = await dat(nguoiA.cookie, room.id, may.id, 10, 9, 11);
    await request(app.getHttpServer())
      .post(`/api/v1/equipment-bookings/${donA.body.data.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Thiết bị đang bảo hành' });

    const res = await dat(nguoiB.cookie, room.id, may.id, 10, 9, 11);
    expect(res.status).toBe(201);
  });

  it('mỗi loại thiết bị tính riêng, không cộng gộp', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const sac = await taoThietBi(room.id, 'Sạc MacBook', 3);
    const gv = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', gv.cookie)
      .send(
        donMau(
          room.id,
          [
            { equipmentId: may.id, quantity: 10 },
            { equipmentId: sac.id, quantity: 3 },
          ],
          9,
          11
        )
      );

    expect(res.status).toBe(201);
  });

  it('trong một đơn nhiều thiết bị, chỉ cần MỘT loại thiếu là chặn cả đơn', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const sac = await taoThietBi(room.id, 'Sạc MacBook', 3);
    const gv = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/equipment-bookings')
      .set('Cookie', gv.cookie)
      .send(
        donMau(
          room.id,
          [
            { equipmentId: may.id, quantity: 5 },
            { equipmentId: sac.id, quantity: 99 },
          ],
          9,
          11
        )
      );

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Sạc MacBook/);
    // Không được tạo đơn nửa vời: cả đơn phải bị huỷ bỏ.
    expect(await testPrisma.equipmentBooking.count({ where: { roomId: room.id } })).toBe(0);
  });

  it('không mượn được thiết bị của phòng khác', async () => {
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();
    const mayA = await taoThietBi(phongA.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const res = await dat(gv.cookie, phongB.id, mayA.id, 1, 9, 11);

    expect(res.status).toBe(409);
  });

  it('không mượn được thiết bị đã ẩn', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    await testPrisma.equipment.update({ where: { id: may.id }, data: { isActive: false } });
    const gv = await loginAs('TEACHER');

    const res = await dat(gv.cookie, room.id, may.id, 1, 9, 11);

    expect(res.status).toBe(409);
  });

  it('400 — số lượng bằng 0 bị Zod chặn', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const res = await dat(gv.cookie, room.id, may.id, 0, 9, 11);

    expect(res.status).toBe(400);
  });

  it('sửa đơn KHÔNG tự chặn chính nó', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 10);
    const gv = await loginAs('TEACHER');

    const don = await dat(gv.cookie, room.id, may.id, 10, 9, 11);
    // Giữ nguyên 10 máy, chỉ đổi lý do — nếu tính cả chính nó thì sẽ báo hết máy.
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/equipment-bookings/${don.body.data.id}`)
      .set('Cookie', gv.cookie)
      .send({ reason: 'Đổi sang dạy lớp 10A2 thay vì 10A1' });

    expect(res.status).toBe(200);
  });
});

describe('Mượn thiết bị — đặt đồng thời', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Đây là chỗ nguy hiểm nhất của toàn module.
   *
   * Mượn PHÒNG có ràng buộc EXCLUDE ở tầng CSDL đỡ, nên dù logic ở service sai
   * thì Postgres vẫn chặn. Mượn THIẾT BỊ thì KHÔNG có ràng buộc CSDL nào — tổng
   * số lượng chỉ được kiểm bằng đọc-rồi-ghi trong transaction. Ở mức cô lập
   * READ COMMITTED (mặc định của Postgres), hai transaction chạy song song đều
   * đọc thấy "còn 2" rồi cùng ghi, và tổng vượt quá số máy thật.
   */
  it('hai người cùng lúc lấy nốt số máy còn lại — tổng KHÔNG được vượt kho', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 2);
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/equipment-bookings')
        .set('Cookie', nguoiA.cookie)
        .send(donMau(room.id, [{ equipmentId: may.id, quantity: 2 }], 9, 11)),
      request(app.getHttpServer())
        .post('/api/v1/equipment-bookings')
        .set('Cookie', nguoiB.cookie)
        .send(donMau(room.id, [{ equipmentId: may.id, quantity: 2 }], 9, 11)),
    ]);

    const daGiu = await testPrisma.equipmentBookingItem.aggregate({
      where: { equipmentId: may.id, booking: { status: { in: ['PENDING', 'APPROVED'] } } },
      _sum: { quantity: true },
    });

    const tomTat = [a, b].map((r) => `${r.status}`).join(',');
    expect(
      daGiu._sum.quantity ?? 0,
      `tổng đã giữ vượt kho (mã trả về: ${tomTat})`
    ).toBeLessThanOrEqual(2);
    expect([a, b].filter((r) => r.status === 201)).toHaveLength(1);
  });

  it('năm người cùng lúc mượn 1 máy trong kho chỉ có 3 — đúng 3 người được', async () => {
    const room = await createTestRoom();
    const may = await taoThietBi(room.id, 'MacBook', 3);
    const nguoi = await Promise.all([1, 2, 3, 4, 5].map(() => loginAs('TEACHER')));

    const ketQua = await Promise.all(
      nguoi.map((n) =>
        request(app.getHttpServer())
          .post('/api/v1/equipment-bookings')
          .set('Cookie', n.cookie)
          .send(donMau(room.id, [{ equipmentId: may.id, quantity: 1 }], 9, 11))
      )
    );

    const daGiu = await testPrisma.equipmentBookingItem.aggregate({
      where: { equipmentId: may.id, booking: { status: { in: ['PENDING', 'APPROVED'] } } },
      _sum: { quantity: true },
    });

    expect(daGiu._sum.quantity ?? 0).toBeLessThanOrEqual(3);
    expect(ketQua.filter((r) => r.status === 201)).toHaveLength(3);
  });
});
