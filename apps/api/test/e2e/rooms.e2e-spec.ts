import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import {
  createTestRoom,
  createTestRoomBooking,
  createTestRoomRule,
  createTestUser,
} from '../factories';
import { testPrisma } from '../db';

/** Tạo user + cookie đã ký sẵn cho một vai trò. */
async function loginAs(role: 'ADMIN' | 'TEACHER' | 'TA' | 'STUDENT') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

describe('Phòng chức năng — phân quyền', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('403 — học sinh gọi thẳng API danh sách phòng vẫn bị chặn', async () => {
    const { cookie } = await loginAs('STUDENT');

    const res = await request(app.getHttpServer()).get('/api/v1/rooms').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('403 — học sinh gọi chi tiết phòng và hồ sơ công tác đều bị chặn', async () => {
    const { cookie } = await loginAs('STUDENT');
    const room = await createTestRoom();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', cookie);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/staff-profile')
      .set('Cookie', cookie);
    const update = await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', cookie)
      .send({ staffCode: 'GV1', department: 'Tổ Tin' });

    expect(detail.status).toBe(403);
    expect(profile.status).toBe(403);
    expect(update.status).toBe(403);
  });

  it('401 — chưa đăng nhập thì không vào được', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/rooms');
    expect(res.status).toBe(401);
  });

  it('200 — giáo viên và trợ giảng đều xem được danh sách', async () => {
    await createTestRoom({ name: 'Phòng Tin học 1' });

    for (const role of ['TEACHER', 'TA'] as const) {
      const { cookie } = await loginAs(role);
      const res = await request(app.getHttpServer()).get('/api/v1/rooms').set('Cookie', cookie);

      expect(res.status, `vai trò ${role}`).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    }
  });
});

describe('GET /api/v1/rooms — lọc phòng đã ẩn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('giáo viên không thấy phòng đã ẩn, kể cả khi tự gửi includeInactive=true', async () => {
    await createTestRoom({ code: 'phong-hien', isActive: true });
    await createTestRoom({ code: 'phong-an', isActive: false });
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get('/api/v1/rooms?includeInactive=true')
      .set('Cookie', cookie);

    const codes = res.body.data.map((r: { code: string }) => r.code);
    expect(res.status).toBe(200);
    expect(codes).toContain('phong-hien');
    expect(codes).not.toContain('phong-an');
  });

  it('admin thấy phòng đã ẩn khi yêu cầu rõ ràng', async () => {
    await createTestRoom({ code: 'phong-an-2', isActive: false });
    const { cookie } = await loginAs('ADMIN');

    const mac_dinh = await request(app.getHttpServer()).get('/api/v1/rooms').set('Cookie', cookie);
    const co_an = await request(app.getHttpServer())
      .get('/api/v1/rooms?includeInactive=true')
      .set('Cookie', cookie);

    const codesMacDinh = mac_dinh.body.data.map((r: { code: string }) => r.code);
    const codesCoAn = co_an.body.data.map((r: { code: string }) => r.code);

    expect(codesMacDinh).not.toContain('phong-an-2');
    expect(codesCoAn).toContain('phong-an-2');
  });

  it('số đơn chờ duyệt chỉ lộ cho admin', async () => {
    const room = await createTestRoom({ code: 'phong-co-don' });
    const owner = await createTestUser({ role: 'TEACHER' });
    await createTestRoomBooking({
      roomId: room.id,
      userId: owner.id,
      startAt: new Date('2026-09-01T02:00:00Z'),
      endAt: new Date('2026-09-01T03:00:00Z'),
      status: 'PENDING',
    });

    const admin = await loginAs('ADMIN');
    const teacher = await loginAs('TEACHER');

    const resAdmin = await request(app.getHttpServer())
      .get('/api/v1/rooms')
      .set('Cookie', admin.cookie);
    const resTeacher = await request(app.getHttpServer())
      .get('/api/v1/rooms')
      .set('Cookie', teacher.cookie);

    const findRoom = (body: { data: { code: string }[] }) =>
      body.data.find((r) => r.code === 'phong-co-don') as unknown as {
        pendingBookingCount: number | null;
      };

    expect(findRoom(resAdmin.body).pendingBookingCount).toBe(1);
    expect(findRoom(resTeacher.body).pendingBookingCount).toBeNull();
  });
});

describe('GET /api/v1/rooms/:code — chi tiết phòng', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('404 — mã phòng không tồn tại', async () => {
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get('/api/v1/rooms/khong-co-that')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('404 với giáo viên nhưng 200 với admin khi phòng đang ẩn', async () => {
    const room = await createTestRoom({ code: 'phong-an-3', isActive: false });
    const teacher = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');

    const resTeacher = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', teacher.cookie);
    const resAdmin = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', admin.cookie);

    expect(resTeacher.status).toBe(404);
    expect(resAdmin.status).toBe(200);
  });

  it('trả về bản nội quy mới nhất, không phải bản đầu tiên', async () => {
    const admin = await loginAs('ADMIN');
    const room = await createTestRoom({ code: 'phong-noi-quy' });
    await createTestRoomRule({ roomId: room.id, updatedById: admin.user.id, version: 1 });
    await createTestRoomRule({
      roomId: room.id,
      updatedById: admin.user.id,
      version: 2,
      content: '<p>Bản mới nhất</p>',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.currentRule).toMatchObject({
      version: 2,
      content: '<p>Bản mới nhất</p>',
    });
  });

  it('currentRule là null khi admin chưa soạn nội quy', async () => {
    const room = await createTestRoom({ code: 'phong-chua-noi-quy' });
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', cookie);

    expect(res.body.data.currentRule).toBeNull();
  });

  it('rơi về tham số mặc định khi phòng chưa có cấu hình riêng', async () => {
    const room = await createTestRoom({ code: 'phong-mac-dinh' });
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', cookie);

    expect(res.body.data.setting).toMatchObject({
      openTime: '07:00',
      closeTime: '17:30',
      isDefault: true,
    });
  });

  it('dùng cấu hình riêng của phòng khi có, và không còn là bản mặc định', async () => {
    const room = await createTestRoom({ code: 'phong-rieng' });
    await testPrisma.roomBookingSetting.create({
      data: { roomId: room.id, openTime: '06:30', closeTime: '21:00', allowWeekend: true },
    });
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rooms/${room.code}`)
      .set('Cookie', cookie);

    expect(res.body.data.setting).toMatchObject({
      openTime: '06:30',
      closeTime: '21:00',
      allowWeekend: true,
      isDefault: false,
    });
  });
});

describe('Hồ sơ công tác (staff profile)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('trả về rỗng khi giáo viên chưa từng điền', async () => {
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get('/api/v1/staff-profile')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ staffCode: null, department: null });
  });

  it('lưu rồi đọc lại đúng giá trị, gọi PATCH lần hai thì ghi đè chứ không tạo thêm', async () => {
    const { user, cookie } = await loginAs('TEACHER');

    await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', cookie)
      .send({ staffCode: 'GV0123', department: 'Tổ Toán - Tin' });

    await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', cookie)
      .send({ staffCode: 'GV9999', department: 'Tổ Lý' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/staff-profile')
      .set('Cookie', cookie);
    const count = await testPrisma.staffProfile.count({ where: { userId: user.id } });

    expect(res.body.data).toEqual({ staffCode: 'GV9999', department: 'Tổ Lý' });
    expect(count).toBe(1);
  });

  it('chuỗi rỗng và chuỗi toàn khoảng trắng đều được lưu thành null', async () => {
    const { cookie } = await loginAs('TA');

    await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', cookie)
      .send({ staffCode: '   ', department: '' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/staff-profile')
      .set('Cookie', cookie);

    expect(res.body.data).toEqual({ staffCode: null, department: null });
  });

  it('400 — mã nhân viên dài quá giới hạn', async () => {
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', cookie)
      .send({ staffCode: 'x'.repeat(51), department: null });

    expect(res.status).toBe(400);
  });

  it('mỗi giáo viên chỉ đọc được hồ sơ của chính mình', async () => {
    const a = await loginAs('TEACHER');
    const b = await loginAs('TEACHER');

    await request(app.getHttpServer())
      .patch('/api/v1/staff-profile')
      .set('Cookie', a.cookie)
      .send({ staffCode: 'CUA-A', department: 'Tổ A' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/staff-profile')
      .set('Cookie', b.cookie);

    expect(res.body.data).toEqual({ staffCode: null, department: null });
  });
});
