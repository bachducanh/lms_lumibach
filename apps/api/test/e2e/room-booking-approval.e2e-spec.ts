import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vnAddDays, vnDateKey, vnDateTimeToUtc } from '@lumibach/types';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestRoomRule, createTestUser } from '../factories';
import { testPrisma } from '../db';

async function loginAs(role: 'ADMIN' | 'TEACHER' | 'TA' | 'STUDENT') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

/** Ngày làm việc gần nhất trong tương lai. */
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

const donMau = (roomId: string, h1: number, h2: number) => ({
  roomId,
  fullName: 'Nguyễn Văn A',
  staffCode: 'GV001',
  department: 'Tổ Toán - Tin',
  reason: 'Dạy thực hành lớp 10A1',
  startAt: gio(h1),
  endAt: gio(h2),
});

describe('Duyệt và từ chối đơn mượn phòng', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function taoDon(cookie: string, roomId: string, h1 = 9, h2 = 11) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, h1, h2));
    return res.body.data as { id: string };
  }

  it('403 — giáo viên không tự duyệt đơn của mình', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const don = await taoDon(gv.cookie, room.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', gv.cookie);

    expect(res.status).toBe(403);
  });

  it('403 — trợ giảng cũng không duyệt được', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const ta = await loginAs('TA');
    const don = await taoDon(gv.cookie, room.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', ta.cookie);

    expect(res.status).toBe(403);
  });

  it('403 — học sinh không vào được hàng chờ duyệt', async () => {
    const hs = await loginAs('STUDENT');
    const res = await request(app.getHttpServer())
      .get('/api/v1/room-bookings/pending')
      .set('Cookie', hs.cookie);

    expect(res.status).toBe(403);
  });

  it('403 — giáo viên không vào được hàng chờ duyệt', async () => {
    const gv = await loginAs('TEACHER');
    const res = await request(app.getHttpServer())
      .get('/api/v1/room-bookings/pending')
      .set('Cookie', gv.cookie);

    expect(res.status).toBe(403);
  });

  it('admin duyệt được, đơn chuyển sang đã duyệt và ghi lại người duyệt', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approvedAt).not.toBeNull();
  });

  it('duyệt xong thì CHỐT phiên bản nội quy hiện hành', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await createTestRoomRule({ roomId: room.id, updatedById: admin.user.id, version: 1 });
    await createTestRoomRule({
      roomId: room.id,
      updatedById: admin.user.id,
      version: 2,
      content: '<p>Bản đang có hiệu lực lúc duyệt</p>',
    });

    const don = await taoDon(gv.cookie, room.id);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    expect(res.body.data.ruleVersionAccepted).toBe(2);
    expect(res.body.data.ruleContent).toBe('<p>Bản đang có hiệu lực lúc duyệt</p>');
  });

  it('ADMIN SỬA NỘI QUY SAU KHI DUYỆT — đơn cũ vẫn giữ đúng bản đã chấp nhận', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await createTestRoomRule({
      roomId: room.id,
      updatedById: admin.user.id,
      version: 1,
      content: '<p>Nội quy lúc giáo viên được duyệt</p>',
    });

    const don = await taoDon(gv.cookie, room.id);
    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    // Admin ra bản nội quy mới SAU khi đơn đã được duyệt.
    await createTestRoomRule({
      roomId: room.id,
      updatedById: admin.user.id,
      version: 2,
      content: '<p>Nội quy mới, đơn cũ KHÔNG được dùng bản này</p>',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', gv.cookie);

    expect(res.body.data.ruleVersionAccepted).toBe(1);
    expect(res.body.data.ruleContent).toBe('<p>Nội quy lúc giáo viên được duyệt</p>');
  });

  it('đơn chưa duyệt thì chưa có nội quy đính kèm', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await createTestRoomRule({ roomId: room.id, updatedById: admin.user.id, version: 1 });
    const don = await taoDon(gv.cookie, room.id);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', gv.cookie);

    expect(res.body.data.ruleVersionAccepted).toBeNull();
    expect(res.body.data.ruleContent).toBeNull();
  });

  it('400 — từ chối mà không nêu lý do', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    const thieu = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({});
    const qua_ngan = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'ko' });

    expect(thieu.status).toBe(400);
    expect(qua_ngan.status).toBe(400);
  });

  it('từ chối kèm lý do thì lý do được lưu và trả về', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Phòng đang bảo trì máy trong tuần này' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectReason).toBe('Phòng đang bảo trì máy trong tuần này');
  });

  it('409 — không duyệt lại đơn đã duyệt', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    const duyetLai = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    expect(duyetLai.status).toBe(409);
  });

  it('RÚT LẠI đơn ĐÃ DUYỆT khi phòng bị trưng dụng đột xuất', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Phòng phải dùng cho kỳ thi đột xuất' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Phòng phải dùng cho kỳ thi đột xuất',
    });

    // Người mượn phải được báo, nếu không họ vẫn tưởng mình còn phòng.
    const thongBao = await testPrisma.notification.findFirst({
      where: { userId: gv.user.id, type: 'ROOM_BOOKING_REJECTED' },
    });
    expect(thongBao?.body).toContain('kỳ thi đột xuất');
  });

  it('rút lại đơn đã duyệt thì giải phóng khung giờ ngay cho người khác', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(nguoiA.cookie, room.id);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);
    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Phòng phải dùng cho việc khác' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiB.cookie)
      .send(donMau(room.id, 9, 11));

    expect(res.status).toBe(201);
  });

  it('409 — đơn ĐANG SỬ DỤNG thì không rút lại được nữa', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(gv.cookie, room.id);

    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: { status: 'CHECKED_IN' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Muốn rút lại khi người ta đang dùng phòng' });

    expect(res.status).toBe(409);
  });

  it('đơn bị từ chối giải phóng khung giờ cho người khác', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(nguoiA.cookie, room.id);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Trùng lịch bảo trì phòng máy' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiB.cookie)
      .send(donMau(room.id, 9, 11));

    expect(res.status).toBe(201);
  });
});

describe('Hàng chờ duyệt và duyệt hàng loạt', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function taoDon(cookie: string, roomId: string, h1: number, h2: number) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, h1, h2));
    return res.body.data as { id: string };
  }

  it('hàng chờ chỉ liệt kê đơn đang chờ duyệt', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const a = await taoDon(gv.cookie, room.id, 9, 10);
    await taoDon(gv.cookie, room.id, 13, 14);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${a.id}/approve`)
      .set('Cookie', admin.cookie);

    const res = await request(app.getHttpServer())
      .get('/api/v1/room-bookings/pending')
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('PENDING');
  });

  it('hàng chờ không báo xung đột khi các đơn không giao nhau', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    await taoDon(gv.cookie, room.id, 9, 10);
    await taoDon(gv.cookie, room.id, 10, 11);

    const res = await request(app.getHttpServer())
      .get('/api/v1/room-bookings/pending')
      .set('Cookie', admin.cookie);

    expect(res.body.data).toHaveLength(2);
    for (const don of res.body.data) {
      expect(don.conflictsWith).toEqual([]);
    }
  });

  // Nhánh "có xung đột" không dựng được qua API vì ràng buộc EXCLUDE chặn từ
  // tầng CSDL — cách duy nhất là tạm gỡ ràng buộc, tức phá đúng thứ đang bảo
  // vệ mình và làm hỏng các test chạy sau. Logic so xung đột vì thế được tách
  // thành hàm thuần và test riêng ở test/unit/booking-conflicts.spec.ts.

  it('duyệt hàng loạt trả về danh sách thành công', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const a = await taoDon(gv.cookie, room.id, 9, 10);
    const b = await taoDon(gv.cookie, room.id, 13, 14);

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings/bulk-approve')
      .set('Cookie', admin.cookie)
      .send({ ids: [a.id, b.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.approved).toHaveLength(2);
    expect(res.body.data.failed).toHaveLength(0);
  });

  it('duyệt hàng loạt: đơn hỏng không kéo theo đơn tốt', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const tot = await taoDon(gv.cookie, room.id, 9, 10);
    const daHuy = await taoDon(gv.cookie, room.id, 13, 14);

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${daHuy.id}/cancel`)
      .set('Cookie', gv.cookie);

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings/bulk-approve')
      .set('Cookie', admin.cookie)
      .send({ ids: [tot.id, daHuy.id, 'ma-khong-ton-tai'] });

    expect(res.body.data.approved).toEqual([tot.id]);
    expect(res.body.data.failed).toHaveLength(2);
    expect(res.body.data.failed.map((f: { id: string }) => f.id)).toContain(daHuy.id);
    // Lý do phải đọc được, không phải mã lỗi kỹ thuật.
    expect(res.body.data.failed[0].reason).toMatch(/\S/);
  });

  it('400 — duyệt hàng loạt với danh sách rỗng', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings/bulk-approve')
      .set('Cookie', admin.cookie)
      .send({ ids: [] });

    expect(res.status).toBe(400);
  });
});

describe('Thông báo', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('nộp đơn → admin nhận thông báo trong hệ thống', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');

    await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    const thongBao = await testPrisma.notification.findMany({
      where: { userId: admin.user.id, type: 'ROOM_BOOKING_SUBMITTED' },
    });

    expect(thongBao).toHaveLength(1);
    expect(thongBao[0]?.title).toContain('chờ duyệt');
    expect(thongBao[0]?.link).toBe('/admin/rooms/bookings');
  });

  it('duyệt đơn → người mượn nhận thông báo nhắc lấy chìa khoá', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/approve`)
      .set('Cookie', admin.cookie);

    const thongBao = await testPrisma.notification.findFirst({
      where: { userId: gv.user.id, type: 'ROOM_BOOKING_APPROVED' },
    });

    expect(thongBao).not.toBeNull();
    expect(thongBao?.body).toBe('Đơn đã được duyệt. Vui lòng gặp Quản trị viên để nhận chìa khoá.');
  });

  it('từ chối đơn → người mượn nhận thông báo kèm lý do', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/reject`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Phòng đang bảo trì' });

    const thongBao = await testPrisma.notification.findFirst({
      where: { userId: gv.user.id, type: 'ROOM_BOOKING_REJECTED' },
    });

    expect(thongBao?.body).toContain('Phòng đang bảo trì');
  });

  it('người mượn tắt thông báo trong hệ thống thì không bị tạo bản ghi', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    await testPrisma.notificationPreference.create({
      data: { userId: gv.user.id, inAppEnabled: false },
    });

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/approve`)
      .set('Cookie', admin.cookie);

    const thongBao = await testPrisma.notification.findMany({ where: { userId: gv.user.id } });
    expect(thongBao).toHaveLength(0);
  });

  it('thông báo hỏng không được làm hỏng thao tác duyệt', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    // Xoá người mượn khỏi bảng thông báo bằng cách vô hiệu hoá tài khoản —
    // nhánh gửi thông báo sẽ đi vào trường hợp bất thường.
    await testPrisma.user.update({
      where: { id: gv.user.id },
      data: { deletedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/approve`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });
});

describe('Xác nhận trả chìa khoá', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('409 — chưa trả phòng thì chưa xác nhận nhận lại chìa khoá được', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/confirm-key-return`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(409);
  });

  it('đơn đã trả phòng → xác nhận xong thì hoàn tất', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    await testPrisma.roomBooking.update({
      where: { id: tao.body.data.id },
      data: { status: 'CHECKED_OUT' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/confirm-key-return`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.keyReturnedAt).not.toBeNull();
  });

  it('403 — giáo viên không tự xác nhận trả chìa khoá', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send(donMau(room.id, 9, 11));

    await testPrisma.roomBooking.update({
      where: { id: tao.body.data.id },
      data: { status: 'CHECKED_OUT' },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/confirm-key-return`)
      .set('Cookie', gv.cookie);

    expect(res.status).toBe(403);
  });
});
