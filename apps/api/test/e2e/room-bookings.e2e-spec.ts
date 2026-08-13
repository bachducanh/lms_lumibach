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

/**
 * Ngày làm việc gần nhất trong tương lai, tránh cuối tuần và tránh mốc "hôm nay"
 * (khung giờ đã qua sẽ bị chặn). Tính động để test không hỏng theo thời gian.
 */
function ngayLamViecSapToi(): string {
  let d = vnAddDays(new Date(), 3);
  // vnParts qua vnDateKey: đẩy tiếp cho tới khi rơi vào thứ 2–6.
  for (let i = 0; i < 7; i++) {
    const weekday = new Date(vnDateTimeToUtc(vnDateKey(d), 12 * 60)).getUTCDay();
    // getUTCDay của mốc 12:00 giờ VN (= 05:00 UTC) vẫn đúng ngày trong tuần.
    if (weekday !== 0 && weekday !== 6) break;
    d = vnAddDays(d, 1);
  }
  return vnDateKey(d);
}

const NGAY = ngayLamViecSapToi();
const gio = (h: number, m = 0) => vnDateTimeToUtc(NGAY, h * 60 + m).toISOString();

/** Cấu hình riêng cho một phòng, để test không phụ thuộc giá trị mặc định. */
async function caiDatPhong(
  roomId: string,
  cauHinh: Partial<{
    allowWeekend: boolean;
    maxDurationMinutes: number;
    minDurationMinutes: number;
    maxAdvanceDays: number;
    openTime: string;
    closeTime: string;
  }>
) {
  return testPrisma.roomBookingSetting.upsert({
    where: { roomId },
    create: { roomId, ...cauHinh },
    update: cauHinh,
  });
}

const donMau = (roomId: string, start: string, end: string) => ({
  roomId,
  fullName: 'Nguyễn Văn A',
  staffCode: 'GV001',
  department: 'Tổ Toán - Tin',
  reason: 'Dạy thực hành lớp 10A1',
  startAt: start,
  endAt: end,
});

describe('POST /api/v1/room-bookings — tạo đơn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('403 — học sinh không tạo được đơn', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('STUDENT');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    expect(res.status).toBe(403);
  });

  it('201 — giáo viên tạo đơn, đơn vào trạng thái chờ duyệt', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      roomId: room.id,
      fullName: 'Nguyễn Văn A',
      isMine: true,
    });
  });

  it('trợ giảng cũng tạo được đơn', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TA');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(13), gio(15)));

    expect(res.status).toBe(201);
  });

  it('404 — phòng đang ngừng sử dụng thì không đặt được', async () => {
    const room = await createTestRoom({ isActive: false });
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    expect(res.status).toBe(404);
  });

  it('400 — ngoài giờ mở cửa, kèm thông báo tiếng Việt', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(5), gio(7)));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/giờ mở cửa/i);
  });

  it('400 — lý do quá ngắn bị Zod chặn', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send({ ...donMau(room.id, gio(9), gio(11)), reason: 'ok' });

    expect(res.status).toBe(400);
  });
});

/**
 * Các ràng buộc lịch chỉ áp cho giáo viên và trợ giảng — admin được bỏ qua để
 * xử lý ngoại lệ. Bộ test này chứng minh quyền bỏ qua đó KHÔNG lọt sang vai trò
 * khác, và thông báo trả về đúng là chuỗi tiếng Việt mà giao diện hiển thị.
 */
describe('Ràng buộc lịch áp cho giáo viên nhưng không áp cho admin', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Ngày trong quá khứ. */
  const quaKhu = (h: number) =>
    vnDateTimeToUtc(vnDateKey(vnAddDays(new Date(), -2)), h * 60).toISOString();

  /** Thứ bảy gần nhất trong tương lai. */
  function thuBayToi(): string {
    let d = vnAddDays(new Date(), 1);
    for (let i = 0; i < 8; i++) {
      if (new Date(vnDateTimeToUtc(vnDateKey(d), 12 * 60)).getUTCDay() === 6) break;
      d = vnAddDays(d, 1);
    }
    return vnDateKey(d);
  }
  const cuoiTuan = (h: number) => vnDateTimeToUtc(thuBayToi(), h * 60).toISOString();

  /** Xa hơn số ngày đặt trước mặc định (30). */
  const quaXa = (h: number) =>
    vnDateTimeToUtc(vnDateKey(vnAddDays(new Date(), 60)), h * 60).toISOString();

  async function dat(cookie: string, roomId: string, start: string, end: string) {
    return request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, start, end));
  }

  it('giáo viên không đặt được khung giờ đã qua, admin thì được', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');

    const resGv = await dat(gv.cookie, room.id, quaKhu(9), quaKhu(11));
    expect(resGv.status).toBe(400);
    expect(resGv.body.error.message).toMatch(/đã qua/i);

    // Admin đặt cùng khung giờ đó phải thành công — chứng minh chặn ở trên đến
    // từ vai trò chứ không phải từ dữ liệu.
    const resAdmin = await dat(admin.cookie, room.id, quaKhu(9), quaKhu(11));
    expect(resAdmin.status).toBe(201);
  });

  it('giáo viên không đặt được cuối tuần, admin thì được', async () => {
    // Đặt cấu hình cho chính phòng này thay vì dựa vào giá trị mặc định toàn
    // hệ thống — mặc định có thể đổi, còn ý nghĩa của test thì không.
    const room = await createTestRoom();
    await caiDatPhong(room.id, { allowWeekend: false });
    const gv = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');

    const resGv = await dat(gv.cookie, room.id, cuoiTuan(9), cuoiTuan(11));
    expect(resGv.status).toBe(400);
    expect(resGv.body.error.message).toMatch(/Thứ bảy và Chủ nhật/i);

    const resAdmin = await dat(admin.cookie, room.id, cuoiTuan(9), cuoiTuan(11));
    expect(resAdmin.status).toBe(201);
  });

  it('giáo viên không đặt vượt thời lượng tối đa', async () => {
    const room = await createTestRoom();
    await caiDatPhong(room.id, { maxDurationMinutes: 240 });
    const gv = await loginAs('TEACHER');

    const res = await dat(gv.cookie, room.id, gio(7), gio(15));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/tối đa 4 tiếng/i);
  });

  it('giáo viên không đặt trước quá số ngày cho phép', async () => {
    const room = await createTestRoom();
    await caiDatPhong(room.id, { maxAdvanceDays: 30 });
    const gv = await loginAs('TEACHER');

    const res = await dat(gv.cookie, room.id, quaXa(9), quaXa(11));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/tối đa 30 ngày/i);
  });

  it('giáo viên không đặt lệch mốc slot 30 phút', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const start = vnDateTimeToUtc(NGAY, 9 * 60 + 10).toISOString();
    const end = vnDateTimeToUtc(NGAY, 11 * 60).toISOString();

    const res = await dat(gv.cookie, room.id, start, end);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/mốc 30 phút/i);
  });

  it('cấu hình riêng của phòng ghi đè bản mặc định — mở cửa muộn hơn thì 07:00 bị chặn', async () => {
    const room = await createTestRoom();
    await testPrisma.roomBookingSetting.create({
      data: { roomId: room.id, openTime: '09:00', closeTime: '16:00' },
    });
    const gv = await loginAs('TEACHER');

    const biChan = await dat(gv.cookie, room.id, gio(7), gio(9));
    const duocPhep = await dat(gv.cookie, room.id, gio(9), gio(11));

    expect(biChan.status).toBe(400);
    expect(biChan.body.error.message).toMatch(/09:00–16:00/);
    expect(duocPhep.status).toBe(201);
  });

  it('trợ giảng chịu đúng bộ ràng buộc như giáo viên', async () => {
    const room = await createTestRoom();
    await caiDatPhong(room.id, { allowWeekend: false });
    const ta = await loginAs('TA');

    const res = await dat(ta.cookie, room.id, cuoiTuan(9), cuoiTuan(11));
    expect(res.status).toBe(400);
  });
});

describe('Chống trùng lịch', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('9:00–10:00 và 10:00–11:00 cùng phòng đều đặt được', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');

    const a = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(10)));
    const b = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(10), gio(11)));

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it('409 — chồng lấn đơn đang chờ duyệt của người khác', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiA.cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiB.cookie)
      .send(donMau(room.id, gio(10), gio(12)));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/vừa có người đặt trước/i);
  });

  it('huỷ đơn xong thì khung giờ đó đặt lại được', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiA.cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', nguoiA.cookie);

    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', nguoiB.cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    expect(res.status).toBe(201);
  });

  it('cùng khung giờ nhưng khác phòng thì không trùng', async () => {
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');

    const a = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(phongA.id, gio(9), gio(11)));
    const b = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(phongB.id, gio(9), gio(11)));

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  it('ĐẶT ĐỒNG THỜI — hai người bắn cùng lúc vào cùng slot, đúng 1 đơn thắng', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/room-bookings')
        .set('Cookie', nguoiA.cookie)
        .send(donMau(room.id, gio(9), gio(11))),
      request(app.getHttpServer())
        .post('/api/v1/room-bookings')
        .set('Cookie', nguoiB.cookie)
        .send(donMau(room.id, gio(9), gio(11))),
    ]);

    const thanhCong = [a, b].filter((r) => r.status === 201);
    const thatBai = [a, b].filter((r) => r.status !== 201);

    expect(thanhCong).toHaveLength(1);
    expect(thatBai).toHaveLength(1);
    // Người thua phải nhận thông báo rõ ràng, không phải lỗi 500.
    expect(thatBai[0]?.status).toBe(409);
    expect(thatBai[0]?.body.error.message).toMatch(/vừa có người đặt trước/i);

    const soDon = await testPrisma.roomBooking.count({ where: { roomId: room.id } });
    expect(soDon).toBe(1);
  });

  it('ĐẶT ĐỒNG THỜI — năm người cùng lúc, vẫn đúng 1 đơn thắng', async () => {
    const room = await createTestRoom();
    const nguoi = await Promise.all([1, 2, 3, 4, 5].map(() => loginAs('TEACHER')));

    const ketQua = await Promise.all(
      nguoi.map((n) =>
        request(app.getHttpServer())
          .post('/api/v1/room-bookings')
          .set('Cookie', n.cookie)
          .send(donMau(room.id, gio(13), gio(15)))
      )
    );

    // Đưa cả mã lỗi lẫn thông báo vào kỳ vọng: khi test này đỏ, thứ cần biết
    // ngay là 4 request thua đã nhận được gì, chứ không phải "mong 4 nhận 0".
    const tomTat = ketQua
      .map((r) => `${r.status}:${r.body?.error?.message ?? r.body?.error?.code ?? 'ok'}`)
      .sort();

    expect(
      ketQua.filter((r) => r.status === 201),
      tomTat.join(' | ')
    ).toHaveLength(1);
    expect(
      ketQua.filter((r) => r.status === 409),
      tomTat.join(' | ')
    ).toHaveLength(4);
    expect(await testPrisma.roomBooking.count({ where: { roomId: room.id } })).toBe(1);
  });
});

describe('PATCH /api/v1/room-bookings/:id — sửa đơn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function taoDon(cookie: string, roomId: string, start = gio(9), end = gio(11)) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, start, end));
    return res.body.data as { id: string };
  }

  it('sửa lý do trên đơn đã duyệt thì đơn VẪN đã duyệt', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const don = await taoDon(cookie, room.id);

    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: { status: 'APPROVED' },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', cookie)
      .send({ reason: 'Đổi sang dạy lớp 10A2 thay vì 10A1' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reason).toBe('Đổi sang dạy lớp 10A2 thay vì 10A1');
  });

  it('đổi giờ trên đơn đã duyệt thì đơn quay về CHỜ DUYỆT và xoá dấu vết duyệt cũ', async () => {
    const room = await createTestRoom();
    const admin = await loginAs('ADMIN');
    const { cookie } = await loginAs('TEACHER');
    const don = await taoDon(cookie, room.id);

    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: {
        status: 'APPROVED',
        approvedById: admin.user.id,
        approvedAt: new Date(),
        ruleVersionAccepted: 1,
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', cookie)
      .send({ startAt: gio(14), endAt: gio(16) });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      approvedByName: null,
      approvedAt: null,
      ruleVersionAccepted: null,
    });
  });

  it('409 — đổi giờ sang khung đã có người khác giữ', async () => {
    const room = await createTestRoom();
    const nguoiA = await loginAs('TEACHER');
    const nguoiB = await loginAs('TEACHER');

    await taoDon(nguoiA.cookie, room.id, gio(9), gio(11));
    const donB = await taoDon(nguoiB.cookie, room.id, gio(13), gio(15));

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${donB.id}`)
      .set('Cookie', nguoiB.cookie)
      .send({ startAt: gio(10), endAt: gio(12) });

    expect(res.status).toBe(409);
  });

  it('403 — người khác không sửa được đơn của mình', async () => {
    const room = await createTestRoom();
    const chuDon = await loginAs('TEACHER');
    const nguoiLa = await loginAs('TEACHER');
    const don = await taoDon(chuDon.cookie, room.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', nguoiLa.cookie)
      .send({ reason: 'Tôi chiếm đơn này của người khác' });

    expect(res.status).toBe(403);
  });

  it('403 — kể cả admin cũng không sửa hộ đơn của giáo viên', async () => {
    const room = await createTestRoom();
    const chuDon = await loginAs('TEACHER');
    const admin = await loginAs('ADMIN');
    const don = await taoDon(chuDon.cookie, room.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', admin.cookie)
      .send({ reason: 'Admin sửa hộ, đáng ra không được' });

    expect(res.status).toBe(403);
  });

  it('409 — không sửa được đơn đã nhận phòng', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const don = await taoDon(cookie, room.id);

    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: { status: 'CHECKED_IN' },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/room-bookings/${don.id}`)
      .set('Cookie', cookie)
      .send({ reason: 'Sửa khi đang dùng phòng, phải bị chặn' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/room-bookings/:id/cancel — huỷ đơn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chủ đơn huỷ được đơn đang chờ duyệt', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('409 — huỷ hai lần thì lần sau bị chặn với thông báo dễ hiểu', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', cookie);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', cookie);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/đã kết thúc/i);
  });

  it('403 — không huỷ được đơn của người khác', async () => {
    const room = await createTestRoom();
    const chuDon = await loginAs('TEACHER');
    const nguoiLa = await loginAs('TEACHER');
    const tao = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', chuDon.cookie)
      .send(donMau(room.id, gio(9), gio(11)));

    const res = await request(app.getHttpServer())
      .post(`/api/v1/room-bookings/${tao.body.data.id}/cancel`)
      .set('Cookie', nguoiLa.cookie);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/room-bookings — nguồn dữ liệu cho lịch', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const khoang = (tuGio: number, denGio: number) => ({
    from: vnDateTimeToUtc(NGAY, tuGio * 60).toISOString(),
    to: vnDateTimeToUtc(NGAY, denGio * 60).toISOString(),
  });

  async function taoDon(cookie: string, roomId: string, h1: number, h2: number) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-bookings')
      .set('Cookie', cookie)
      .send(donMau(roomId, gio(h1), gio(h2)));
    return res.body.data as { id: string };
  }

  it('lấy được đơn bắt đầu TRƯỚC khoảng nhìn nhưng còn kéo dài vào trong', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    await taoDon(cookie, room.id, 9, 12);

    const k = khoang(10, 11);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}&roomId=${room.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('KHÔNG lấy đơn chỉ chạm mép khoảng nhìn (nửa mở)', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    await taoDon(cookie, room.id, 9, 10);

    const k = khoang(10, 12);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}&roomId=${room.id}`)
      .set('Cookie', cookie);

    expect(res.body.data).toHaveLength(0);
  });

  it('lọc theo tổ chuyên môn', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const don = await taoDon(cookie, room.id, 9, 10);
    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: { department: 'Tổ Vật lý' },
    });
    await taoDon(cookie, room.id, 13, 14);

    const k = khoang(7, 18);
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/room-bookings?from=${k.from}&to=${k.to}&department=${encodeURIComponent('Tổ Vật lý')}`
      )
      .set('Cookie', cookie);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].department).toBe('Tổ Vật lý');
  });

  it('lọc "chỉ đơn của tôi"', async () => {
    const room = await createTestRoom();
    const toi = await loginAs('TEACHER');
    const nguoiKhac = await loginAs('TEACHER');
    await taoDon(toi.cookie, room.id, 9, 10);
    await taoDon(nguoiKhac.cookie, room.id, 13, 14);

    const k = khoang(7, 18);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}&roomId=${room.id}&mine=true`)
      .set('Cookie', toi.cookie);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isMine).toBe(true);
  });

  it('giáo viên thấy đơn của người khác trên lịch nhưng isMine = false', async () => {
    const room = await createTestRoom();
    const nguoiKhac = await loginAs('TEACHER');
    const toi = await loginAs('TEACHER');
    await taoDon(nguoiKhac.cookie, room.id, 9, 10);

    const k = khoang(7, 18);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}&roomId=${room.id}`)
      .set('Cookie', toi.cookie);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isMine).toBe(false);
  });

  it('lọc theo trạng thái, nhiều giá trị ngăn bằng dấu phẩy', async () => {
    const room = await createTestRoom();
    const { cookie } = await loginAs('TEACHER');
    const a = await taoDon(cookie, room.id, 9, 10);
    await taoDon(cookie, room.id, 13, 14);
    await testPrisma.roomBooking.update({ where: { id: a.id }, data: { status: 'APPROVED' } });

    const k = khoang(7, 18);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}&roomId=${room.id}&status=APPROVED`)
      .set('Cookie', cookie);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('APPROVED');
  });

  it('403 — học sinh không đọc được lịch', async () => {
    const { cookie } = await loginAs('STUDENT');
    const k = khoang(7, 18);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/room-bookings?from=${k.from}&to=${k.to}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });
});
