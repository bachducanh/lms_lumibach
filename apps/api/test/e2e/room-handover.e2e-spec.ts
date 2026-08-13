import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestUser } from '../factories';
import { testPrisma } from '../db';

async function loginAs(role: 'ADMIN' | 'TEACHER' | 'TA' | 'STUDENT') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

/**
 * Đơn ở trạng thái sẵn sàng nhận phòng, với khung giờ bao quanh thời điểm hiện
 * tại để lọt cửa sổ cho phép nhận phòng.
 */
async function taoDonSanSang(
  roomId: string,
  userId: string,
  status: 'PENDING' | 'APPROVED' = 'APPROVED'
) {
  await testPrisma.roomBookingSetting.upsert({
    where: { roomId },
    create: { roomId, minPhotosPerHandover: 0 },
    update: { minPhotosPerHandover: 0 },
  });

  const now = Date.now();
  return testPrisma.roomBooking.create({
    data: {
      roomId,
      userId,
      fullName: 'Nguyễn Văn A',
      department: 'Tổ Toán - Tin',
      reason: 'Dạy thực hành',
      startAt: new Date(now - 10 * 60_000),
      endAt: new Date(now + 110 * 60_000),
      status,
    },
  });
}

async function taoTruong(
  roomId: string | null,
  over: Partial<{
    key: string;
    label: string;
    dataType: 'NUMBER' | 'TEXT' | 'SELECT' | 'BOOLEAN';
    options: string[];
    isRequired: boolean;
    appliesTo: 'CHECKIN' | 'CHECKOUT' | 'BOTH';
  }> = {}
) {
  return testPrisma.handoverField.create({
    data: {
      roomId,
      key: over.key ?? 'so_may',
      label: over.label ?? 'Số máy',
      dataType: over.dataType ?? 'NUMBER',
      options: over.options,
      isRequired: over.isRequired ?? false,
      appliesTo: over.appliesTo ?? 'BOTH',
    },
  });
}

describe('Cấu hình trường bàn giao', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('403 — học sinh không đọc được, giáo viên không tạo được', async () => {
    const hs = await loginAs('STUDENT');
    const gv = await loginAs('TEACHER');

    const doc = await request(app.getHttpServer())
      .get('/api/v1/handover-fields')
      .set('Cookie', hs.cookie);
    const tao = await request(app.getHttpServer())
      .post('/api/v1/handover-fields')
      .set('Cookie', gv.cookie)
      .send({ key: 'so_may', label: 'Số máy', dataType: 'NUMBER' });

    expect(doc.status).toBe(403);
    expect(tao.status).toBe(403);
  });

  it('trường riêng của phòng GHI ĐÈ trường dùng chung khi trùng khoá', async () => {
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy (chung)' });
    await taoTruong(room.id, { key: 'so_may', label: 'Số máy Windows' });
    const gv = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/handover-fields?roomId=${room.id}`)
      .set('Cookie', gv.cookie);

    const soMay = res.body.data.filter((f: { key: string }) => f.key === 'so_may');
    expect(soMay).toHaveLength(1);
    expect(soMay[0].label).toBe('Số máy Windows');
    expect(soMay[0].isShared).toBe(false);
  });

  it('phòng khác vẫn dùng trường chung', async () => {
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();
    await taoTruong(null, { key: 'so_chuot', label: 'Số chuột (chung)' });
    await taoTruong(phongA.id, { key: 'so_chuot', label: 'Riêng phòng A' });
    const gv = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/handover-fields?roomId=${phongB.id}`)
      .set('Cookie', gv.cookie);

    const truong = res.body.data.find((f: { key: string }) => f.key === 'so_chuot');
    expect(truong.label).toBe('Số chuột (chung)');
    expect(truong.isShared).toBe(true);
  });

  it('lọc theo lượt bàn giao', async () => {
    const room = await createTestRoom();
    await taoTruong(null, { key: 'chi_nhan', appliesTo: 'CHECKIN' });
    await taoTruong(null, { key: 'chi_tra', appliesTo: 'CHECKOUT' });
    await taoTruong(null, { key: 'ca_hai', appliesTo: 'BOTH' });
    const gv = await loginAs('TEACHER');

    const nhan = await request(app.getHttpServer())
      .get(`/api/v1/handover-fields?roomId=${room.id}&applies=CHECKIN`)
      .set('Cookie', gv.cookie);

    const keys = nhan.body.data.map((f: { key: string }) => f.key).sort();
    expect(keys).toEqual(['ca_hai', 'chi_nhan']);
  });

  it('409 — trùng khoá trong cùng phạm vi', async () => {
    const admin = await loginAs('ADMIN');
    await taoTruong(null, { key: 'so_ban_phim' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/handover-fields')
      .set('Cookie', admin.cookie)
      .send({ key: 'so_ban_phim', label: 'Số bàn phím', dataType: 'NUMBER' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/dùng chung/i);
  });

  it('400 — trường dạng chọn thiếu lựa chọn', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/v1/handover-fields')
      .set('Cookie', admin.cookie)
      .send({ key: 've_sinh', label: 'Vệ sinh', dataType: 'SELECT', options: ['Sạch'] });

    expect(res.status).toBe(400);
  });

  it('400 — khoá sai định dạng', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app.getHttpServer())
      .post('/api/v1/handover-fields')
      .set('Cookie', admin.cookie)
      .send({ key: 'Số Máy', label: 'Số máy', dataType: 'NUMBER' });

    expect(res.status).toBe(400);
  });

  it('trường CHƯA dùng thì xoá hẳn, trường ĐÃ dùng thì chỉ bị ẩn', async () => {
    const admin = await loginAs('ADMIN');
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const chuaDung = await taoTruong(null, { key: 'chua_dung' });
    const daDung = await taoTruong(null, { key: 'da_dung' });

    const booking = await taoDonSanSang(room.id, gv.user.id);
    await testPrisma.handover.create({
      data: {
        bookableType: 'ROOM',
        type: 'CHECKIN',
        roomBookingId: booking.id,
        performedById: gv.user.id,
        conditionNote: 'Phòng sạch',
        fieldValues: { da_dung: 10 },
      },
    });

    const xoa = await request(app.getHttpServer())
      .delete(`/api/v1/handover-fields/${chuaDung.id}`)
      .set('Cookie', admin.cookie);
    const an = await request(app.getHttpServer())
      .delete(`/api/v1/handover-fields/${daDung.id}`)
      .set('Cookie', admin.cookie);

    expect(xoa.body.data).toEqual({ deleted: true, deactivated: false });
    expect(an.body.data).toEqual({ deleted: false, deactivated: true });

    expect(await testPrisma.handoverField.findUnique({ where: { id: chuaDung.id } })).toBeNull();
    const conLai = await testPrisma.handoverField.findUnique({ where: { id: daDung.id } });
    expect(conLai?.isActive).toBe(false);
  });
});

describe('Nhận phòng', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CHẶN khi chưa tick xác nhận đã đọc nội quy', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: false, conditionNote: 'Phòng sạch sẽ', fieldValues: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/đã đọc nội quy/i);

    const sau = await testPrisma.roomBooking.findUnique({ where: { id: booking.id } });
    expect(sau?.status).toBe('APPROVED');
  });

  it('nhận phòng thành công thì đơn chuyển sang đang sử dụng', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', dataType: 'NUMBER' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ', fieldValues: { so_may: 30 } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ type: 'CHECKIN', ruleAccepted: true });
    expect(res.body.data.fieldValues.so_may).toBe(30);

    const sau = await testPrisma.roomBooking.findUnique({ where: { id: booking.id } });
    expect(sau?.status).toBe('CHECKED_IN');
  });

  it('409 — đơn chưa được duyệt thì chưa nhận phòng được', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id, 'PENDING');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ' });

    expect(res.status).toBe(409);
  });

  it('403 — người khác không nhận phòng hộ được', async () => {
    const gv = await loginAs('TEACHER');
    const nguoiLa = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', nguoiLa.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ' });

    expect(res.status).toBe(403);
  });

  it('CHẶN khi còn quá sớm so với giờ bắt đầu', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const now = Date.now();
    const booking = await testPrisma.roomBooking.create({
      data: {
        roomId: room.id,
        userId: gv.user.id,
        fullName: 'Nguyễn Văn A',
        reason: 'Dạy thực hành',
        // Bắt đầu sau 3 tiếng, ngoài cửa sổ 15 phút.
        startAt: new Date(now + 180 * 60_000),
        endAt: new Date(now + 240 * 60_000),
        status: 'APPROVED',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/15 phút trước giờ bắt đầu/i);
  });

  it('400 — thiếu trường bắt buộc', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy', isRequired: true });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ', fieldValues: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Số máy/);
  });

  it('400 — giá trị chọn không nằm trong danh sách', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, {
      key: 've_sinh',
      label: 'Vệ sinh',
      dataType: 'SELECT',
      options: ['Sạch', 'Cần dọn'],
    });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({
        ruleAccepted: true,
        conditionNote: 'Phòng sạch sẽ',
        fieldValues: { ve_sinh: 'Bẩn kinh khủng' },
      });

    expect(res.status).toBe(400);
  });

  it('400 — số âm bị từ chối', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ', fieldValues: { so_may: -5 } });

    expect(res.status).toBe(400);
  });

  it('bỏ qua khoá lạ, không lưu dữ liệu không có định nghĩa', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({
        ruleAccepted: true,
        conditionNote: 'Phòng sạch sẽ',
        fieldValues: { so_may: 30, khoa_la: 'dữ liệu rác' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.fieldValues).toEqual({ so_may: 30 });
  });

  it('400 — mô tả tình trạng quá ngắn', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/checkin`)
      .set('Cookie', gv.cookie)
      .send({ ruleAccepted: true, conditionNote: 'ok' });

    expect(res.status).toBe(400);
  });
});

describe('Trả phòng và so lệch số liệu', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function nhanPhong(
    cookie: string,
    bookingId: string,
    fieldValues: Record<string, unknown>
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${bookingId}/checkin`)
      .set('Cookie', cookie)
      .send({ ruleAccepted: true, conditionNote: 'Phòng sạch sẽ, máy chạy tốt', fieldValues });
  }

  async function traPhong(cookie: string, bookingId: string, fieldValues: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${bookingId}/checkout`)
      .set('Cookie', cookie)
      .send({ conditionNote: 'Đã dọn dẹp, tắt máy đầy đủ', fieldValues });
  }

  it('409 — KHÔNG trả phòng được khi chưa nhận phòng', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await traPhong(gv.cookie, booking.id, {});

    expect(res.status).toBe(409);
  });

  it('trả đủ số liệu thì đơn KHÔNG bị đánh dấu lệch', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, { so_may: 30 });
    const res = await traPhong(gv.cookie, booking.id, { so_may: 30 });

    expect(res.status).toBe(200);
    const sau = await testPrisma.roomBooking.findUnique({ where: { id: booking.id } });
    expect(sau?.status).toBe('CHECKED_OUT');
    expect(sau?.hasDiscrepancy).toBe(false);
  });

  it('SỐ MÁY TRẢ ÍT HƠN SỐ MƯỢN → đơn bị đánh dấu để admin xem lại', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, { so_may: 30 });
    const res = await traPhong(gv.cookie, booking.id, { so_may: 28 });

    expect(res.status).toBe(200);
    const sau = await testPrisma.roomBooking.findUnique({ where: { id: booking.id } });
    expect(sau?.hasDiscrepancy).toBe(true);
  });

  it('trả nhiều hơn lúc nhận thì KHÔNG bị coi là thiếu hụt', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, { so_may: 28 });
    await traPhong(gv.cookie, booking.id, { so_may: 30 });

    const sau = await testPrisma.roomBooking.findUnique({ where: { id: booking.id } });
    expect(sau?.hasDiscrepancy).toBe(false);
  });

  it('bảng đối chiếu nêu rõ trường nào thiếu bao nhiêu', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    await taoTruong(null, { key: 'so_may', label: 'Số máy' });
    await taoTruong(null, { key: 'so_chuot', label: 'Số chuột' });
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, { so_may: 30, so_chuot: 15 });
    await traPhong(gv.cookie, booking.id, { so_may: 30, so_chuot: 12 });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings/${booking.id}/handovers`)
      .set('Cookie', gv.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.hasDiscrepancy).toBe(true);
    const chuot = res.body.data.diff.find((d: { key: string }) => d.key === 'so_chuot');
    expect(chuot).toMatchObject({
      label: 'Số chuột',
      checkinValue: 15,
      checkoutValue: 12,
      shortfall: 3,
    });
    const may = res.body.data.diff.find((d: { key: string }) => d.key === 'so_may');
    expect(may.shortfall).toBe(0);
  });

  it('409 — không trả phòng hai lần', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, {});
    await traPhong(gv.cookie, booking.id, {});
    const lanHai = await traPhong(gv.cookie, booking.id, {});

    expect(lanHai.status).toBe(409);
  });

  it('409 — không nhận phòng hai lần', async () => {
    const gv = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, {});
    const lanHai = await nhanPhong(gv.cookie, booking.id, {});

    expect(lanHai.status).toBe(409);
  });

  it('admin đọc được dữ liệu bàn giao của đơn người khác', async () => {
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);
    await nhanPhong(gv.cookie, booking.id, {});

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings/${booking.id}/handovers`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.checkin).not.toBeNull();
  });

  it('403 — giáo viên khác không đọc được dữ liệu bàn giao', async () => {
    const gv = await loginAs('TEACHER');
    const nguoiLa = await loginAs('TEACHER');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings/${booking.id}/handovers`)
      .set('Cookie', nguoiLa.cookie);

    expect(res.status).toBe(403);
  });

  it('sau khi trả phòng, admin xác nhận chìa khoá thì đơn hoàn tất', async () => {
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const room = await createTestRoom();
    const booking = await taoDonSanSang(room.id, gv.user.id);

    await nhanPhong(gv.cookie, booking.id, {});
    await traPhong(gv.cookie, booking.id, {});

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${booking.id}/confirm-key-return`)
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });
});
