import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { vnAddDays, vnDateKey, vnDateTimeToUtc } from '@lumibach/types';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestUser } from '../factories';
import { testPrisma } from '../db';

async function loginAs(role: 'ADMIN' | 'TEACHER') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

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
  fullName: 'LumiBach Admin',
  staffCode: 'AD001',
  department: 'Ban Giám hiệu',
  reason: 'Họp tổ chuyên môn',
  startAt: gio(h1),
  endAt: gio(h2),
});

/**
 * Quản trị viên cũng là người dùng phòng: họ dạy, họp tổ, coi thi. Bộ test này
 * khoá lại việc admin đi trọn vòng đời đơn của CHÍNH MÌNH y như giáo viên —
 * quyền quản trị không được làm hỏng vai trò người mượn.
 */
describe('Admin tự đăng ký mượn phòng như người dùng bình thường', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin tạo được đơn cho chính mình, đơn vào trạng thái chờ duyệt', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', admin.cookie)
      .send(donMau(room.id, 9, 11));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'PENDING', isMine: true });
  });

  it('admin thấy đủ nút của chủ đơn TRÊN ĐƠN CỦA MÌNH', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', admin.cookie)
      .send(donMau(room.id, 9, 11));

    const actions: string[] = tao.body.data.availableActions;
    // Vừa là chủ đơn vừa là người duyệt nên có cả hai nhóm.
    expect(actions).toContain('cancel');
    expect(actions).toContain('reschedule');
    expect(actions).toContain('approve');
    expect(actions).toContain('reject');
  });

  it('admin tự duyệt đơn của mình rồi đi hết vòng nhận và trả phòng', async () => {
    const room = await createTestRoom();
    await testPrisma.roomBookingSetting.upsert({
      where: { roomId: room.id },
      create: { roomId: room.id, minPhotosPerHandover: 0 },
      update: { minPhotosPerHandover: 0 },
    });
    const admin = await loginAs('ADMIN');

    // Khung giờ bao quanh hiện tại để lọt cửa sổ nhận phòng.
    const now = Date.now();
    const don = await testPrisma.roomBooking.create({
      data: {
        roomId: room.id,
        userId: admin.user.id,
        fullName: 'LumiBach Admin',
        reason: 'Họp tổ chuyên môn',
        startAt: new Date(now - 10 * 60_000),
        endAt: new Date(now + 110 * 60_000),
        status: 'PENDING',
      },
    });

    const duyet = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/approve`)
      .set('Cookie', admin.cookie);
    const nhan = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/checkin`)
      .set('Cookie', admin.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ, máy chạy tốt' });
    const tra = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/checkout`)
      .set('Cookie', admin.cookie)
      .send({ conditionNote: 'Đã dọn dẹp và tắt máy đầy đủ' });
    const chiaKhoa = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/confirm-key-return`)
      .set('Cookie', admin.cookie);

    expect(duyet.status).toBe(200);
    expect(nhan.status).toBe(200);
    expect(tra.status).toBe(200);
    expect(chiaKhoa.body.data.status).toBe('COMPLETED');
  });

  it('admin huỷ và sửa được đơn của chính mình', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');

    const a = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', admin.cookie)
      .send(donMau(room.id, 9, 11));
    const sua = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${a.body.data.id}`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Đổi sang họp chuyên đề đầu năm' });
    const huy = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${a.body.data.id}/cancel`)
      .set('Cookie', admin.cookie);

    expect(sua.status).toBe(200);
    expect(huy.body.data.status).toBe('CANCELLED');
  });

  it('đơn của admin cũng giữ chỗ, giáo viên không đặt đè lên được', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');

    await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', admin.cookie)
      .send(donMau(room.id, 9, 11));

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send({ ...donMau(room.id, 10, 12), fullName: 'Nguyễn Văn A' });

    expect(res.status).toBe(409);
  });

  it('mọi thao tác của admin đều được ghi vào nhật ký', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', admin.cookie)
      .send(donMau(room.id, 13, 15));
    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/approve`)
      .set('Cookie', admin.cookie);

    const nhatKy = await testPrisma.auditLog.findMany({
      where: { resourceId: tao.body.data.id },
      select: { action: true, userId: true, userRole: true },
    });

    expect(nhatKy.map((n) => n.action).sort()).toEqual([
      'ROOM_BOOKING_APPROVE',
      'ROOM_BOOKING_CREATE',
    ]);
    for (const dong of nhatKy) {
      expect(dong.userId).toBe(admin.user.id);
      expect(dong.userRole).toBe('ADMIN');
    }
  });
});

describe('Nhật ký cho thao tác của giáo viên', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('đăng ký, sửa và huỷ đơn đều để lại dấu vết đủ để truy ngược', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', gv.cookie)
      .send({ ...donMau(room.id, 9, 11), fullName: 'Nguyễn Văn A' });
    await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${tao.body.data.id}`)
      .set('Cookie', gv.cookie)
      .send({ startAt: gio(13), endAt: gio(15) });
    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', gv.cookie);

    const nhatKy = await testPrisma.auditLog.findMany({
      where: { resourceId: tao.body.data.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(nhatKy.map((n) => n.action)).toEqual([
      'ROOM_BOOKING_CREATE',
      'ROOM_BOOKING_UPDATE',
      'ROOM_BOOKING_CANCEL',
    ]);

    // Bản ghi sửa phải nêu được đổi từ gì sang gì, không chỉ "đã sửa".
    const banGhiSua = nhatKy.find((n) => n.action === 'ROOM_BOOKING_UPDATE');
    const thayDoi = banGhiSua?.changes as { truoc?: unknown; sau?: unknown } | null;
    expect(thayDoi?.truoc).toBeTruthy();
    expect(thayDoi?.sau).toBeTruthy();

    for (const dong of nhatKy) {
      expect(dong.userId).toBe(gv.user.id);
      expect(dong.resource).toBe('RoomBooking');
    }
  });

  it('nhận và trả phòng cũng vào nhật ký, kèm cờ lệch số liệu', async () => {
    const room = await createTestRoom();
    await testPrisma.roomBookingSetting.upsert({
      where: { roomId: room.id },
      create: { roomId: room.id, minPhotosPerHandover: 0 },
      update: { minPhotosPerHandover: 0 },
    });
    await testPrisma.handoverField.create({
      data: { roomId: null, key: 'so_may', label: 'Số máy', dataType: 'NUMBER' },
    });
    const gv = await loginAs('TEACHER');

    const now = Date.now();
    const don = await testPrisma.roomBooking.create({
      data: {
        roomId: room.id,
        userId: gv.user.id,
        fullName: 'Nguyễn Văn A',
        reason: 'Dạy thực hành',
        startAt: new Date(now - 10 * 60_000),
        endAt: new Date(now + 110 * 60_000),
        status: 'APPROVED',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Đủ 30 máy', fieldValues: { so_may: 30 } });
    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${don.id}/checkout`)
      .set('Cookie', gv.cookie)
      .send({ conditionNote: 'Thiếu 2 máy hỏng', fieldValues: { so_may: 28 } });

    const nhatKy = await testPrisma.auditLog.findMany({ where: { resourceId: don.id } });
    const traPhong = nhatKy.find((n) => n.action === 'ROOM_BOOKING_CHECKOUT');
    const meta = traPhong?.metadata as { hasDiscrepancy?: boolean } | null;

    expect(nhatKy.map((n) => n.action).sort()).toEqual([
      'ROOM_BOOKING_CHECKIN',
      'ROOM_BOOKING_CHECKOUT',
    ]);
    expect(meta?.hasDiscrepancy).toBe(true);
  });
});
