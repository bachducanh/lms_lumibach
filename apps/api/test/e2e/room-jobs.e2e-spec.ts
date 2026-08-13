import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestRoom, createTestUser } from '../factories';
import { testPrisma } from '../db';

const CRON_SECRET = process.env.CRON_SECRET ?? 'test-cron-secret';

async function loginAs(role: 'ADMIN' | 'TEACHER') {
  const user = await createTestUser({ role });
  const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });
  return { user, cookie: cookieHeader(token) };
}

const gioTruoc = (soGio: number) => new Date(Date.now() - soGio * 3_600_000);

async function taoDonPhong(
  roomId: string,
  userId: string,
  status: 'PENDING' | 'APPROVED' | 'CHECKED_IN' | 'COMPLETED',
  ketThucCachDay: number
) {
  return testPrisma.roomBooking.create({
    data: {
      roomId,
      userId,
      fullName: 'Nguyễn Văn A',
      reason: 'Dạy thực hành',
      startAt: gioTruoc(ketThucCachDay + 2),
      endAt: gioTruoc(ketThucCachDay),
      status,
    },
  });
}

describe('Job đánh dấu không đến nhận', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const chay = (secret?: string) => {
    const req = request(app.getHttpServer()).post('/api/v1/room-jobs/no-show');
    return secret === undefined ? req : req.set('x-cron-secret', secret);
  };

  it('401 — không có cron secret', async () => {
    expect((await chay()).status).toBe(401);
  });

  it('401 — sai cron secret', async () => {
    expect((await chay('sai-be-bet')).status).toBe(401);
  });

  it('401 — phiên đăng nhập của admin KHÔNG thay được cron secret', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app.getHttpServer())
      .post('/api/v1/room-jobs/no-show')
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(401);
  });

  it('đơn ĐÃ DUYỆT mà quá giờ kết thúc thì bị đánh dấu', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const don = await taoDonPhong(room.id, gv.user.id, 'APPROVED', 1);

    const res = await chay(CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.data.roomBookings).toBeGreaterThanOrEqual(1);
    const sau = await testPrisma.roomBooking.findUnique({ where: { id: don.id } });
    expect(sau?.status).toBe('NO_SHOW');
  });

  it('đơn CHƯA tới giờ kết thúc thì KHÔNG bị đụng tới', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const don = await testPrisma.roomBooking.create({
      data: {
        roomId: room.id,
        userId: gv.user.id,
        fullName: 'Nguyễn Văn A',
        reason: 'Dạy thực hành',
        startAt: new Date(Date.now() - 30 * 60_000),
        endAt: new Date(Date.now() + 90 * 60_000),
        status: 'APPROVED',
      },
    });

    await chay(CRON_SECRET);

    const sau = await testPrisma.roomBooking.findUnique({ where: { id: don.id } });
    expect(sau?.status).toBe('APPROVED');
  });

  /**
   * Đây là ranh giới quan trọng nhất của job này: người mượn được phép nhận
   * phòng muộn cho tới hết khung giờ. Nếu job đánh dấu ngay khi quá giờ BẮT ĐẦU
   * thì giáo viên đến trễ 20 phút sẽ thấy đơn của mình đã bị huỷ.
   */
  it('quá giờ BẮT ĐẦU nhưng chưa hết giờ thì vẫn để nguyên', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const don = await testPrisma.roomBooking.create({
      data: {
        roomId: room.id,
        userId: gv.user.id,
        fullName: 'Nguyễn Văn A',
        reason: 'Dạy thực hành',
        startAt: new Date(Date.now() - 3 * 3_600_000),
        endAt: new Date(Date.now() + 60_000),
        status: 'APPROVED',
      },
    });

    await chay(CRON_SECRET);

    expect((await testPrisma.roomBooking.findUnique({ where: { id: don.id } }))?.status).toBe(
      'APPROVED'
    );
  });

  it.each(['PENDING', 'CHECKED_IN', 'COMPLETED'] as const)(
    'đơn ở trạng thái %s thì job không đụng tới',
    async (status) => {
      const room = await createTestRoom();
      const gv = await loginAs('TEACHER');
      const don = await taoDonPhong(room.id, gv.user.id, status, 5);

      await chay(CRON_SECRET);

      expect((await testPrisma.roomBooking.findUnique({ where: { id: don.id } }))?.status).toBe(
        status
      );
    }
  );

  it('người mượn nhận được thông báo', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    await taoDonPhong(room.id, gv.user.id, 'APPROVED', 2);

    await chay(CRON_SECRET);

    const thongBao = await testPrisma.notification.findFirst({
      where: { userId: gv.user.id, type: 'ROOM_BOOKING_NO_SHOW' },
    });
    expect(thongBao).not.toBeNull();
    expect(thongBao?.link).toBe('/rooms/bookings');
  });

  it('chạy hai lần liên tiếp thì lần sau không đánh dấu lại gì', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    await taoDonPhong(room.id, gv.user.id, 'APPROVED', 3);

    const lan1 = await chay(CRON_SECRET);
    const lan2 = await chay(CRON_SECRET);

    expect(lan1.body.data.roomBookings).toBe(1);
    expect(lan2.body.data.roomBookings).toBe(0);
  });

  it('đơn mượn thiết bị quá hạn cũng được đánh dấu và giải phóng số lượng', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const may = await testPrisma.equipment.create({
      data: { roomId: room.id, name: 'MacBook', unit: 'máy', totalQuantity: 5 },
    });
    const don = await testPrisma.equipmentBooking.create({
      data: {
        roomId: room.id,
        userId: gv.user.id,
        fullName: 'Nguyễn Văn A',
        reason: 'Mượn máy',
        startAt: gioTruoc(4),
        endAt: gioTruoc(2),
        status: 'APPROVED',
        items: { create: [{ equipmentId: may.id, quantity: 5 }] },
      },
    });

    const res = await chay(CRON_SECRET);

    expect(res.body.data.equipmentBookings).toBe(1);
    expect((await testPrisma.equipmentBooking.findUnique({ where: { id: don.id } }))?.status).toBe(
      'NO_SHOW'
    );
  });

  it('ghi vào nhật ký để truy ngược được', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const don = await taoDonPhong(room.id, gv.user.id, 'APPROVED', 6);

    await chay(CRON_SECRET);

    const nhatKy = await testPrisma.auditLog.findFirst({
      where: { resourceId: don.id, action: 'ROOM_BOOKING_NO_SHOW' },
    });
    expect(nhatKy).not.toBeNull();
    expect((nhatKy?.metadata as { boiCron?: boolean } | null)?.boiCron).toBe(true);
  });
});

describe('Job dọn ảnh bàn giao quá hạn', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const chay = (secret?: string) => {
    const req = request(app.getHttpServer()).post('/api/v1/room-jobs/purge-photos');
    return secret === undefined ? req : req.set('x-cron-secret', secret);
  };

  /** Tạo một lượt bàn giao kèm ảnh, với ngày tạo ảnh đẩy lùi về quá khứ. */
  async function taoAnh(roomId: string, userId: string, soThangTruoc: number) {
    const don = await testPrisma.roomBooking.create({
      data: {
        roomId,
        userId,
        fullName: 'Nguyễn Văn A',
        reason: 'Dạy thực hành',
        startAt: gioTruoc(4),
        endAt: gioTruoc(2),
        status: 'COMPLETED',
      },
    });
    const banGiao = await testPrisma.handover.create({
      data: {
        bookableType: 'ROOM',
        type: 'CHECKIN',
        roomBookingId: don.id,
        performedById: userId,
        conditionNote: 'Phòng sạch',
        fieldValues: {},
      },
    });
    const anh = await testPrisma.handoverPhoto.create({
      data: {
        handoverId: banGiao.id,
        bucket: 'lumibach-handovers',
        objectName: `handover-photos/${userId}/${Math.random().toString(16).slice(2)}.jpg`,
        mime: 'image/jpeg',
        size: 1234,
        sha256: 'a'.repeat(64),
        width: 800,
        height: 600,
      },
    });

    // createdAt có @default(now()) nên phải đẩy lùi bằng update.
    await testPrisma.handoverPhoto.update({
      where: { id: anh.id },
      data: { createdAt: new Date(Date.now() - soThangTruoc * 30 * 86_400_000) },
    });

    return { don, banGiao, anh };
  }

  it('401 — sai cron secret', async () => {
    expect((await chay('sai')).status).toBe(401);
  });

  it('ảnh mới thì giữ nguyên', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const { anh } = await taoAnh(room.id, gv.user.id, 1);

    const res = await chay(CRON_SECRET);

    expect(res.body.data.purged).toBe(0);
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: anh.id } })).not.toBeNull();
  });

  it('ảnh quá 12 tháng (mặc định) thì bị dọn', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const { anh } = await taoAnh(room.id, gv.user.id, 14);

    const res = await chay(CRON_SECRET);

    expect(res.body.data.purged).toBe(1);
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: anh.id } })).toBeNull();
  });

  it('GIỮ NGUYÊN bản ghi bàn giao — chỉ ảnh bị xoá', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const { banGiao, don } = await taoAnh(room.id, gv.user.id, 14);

    await chay(CRON_SECRET);

    const conBanGiao = await testPrisma.handover.findUnique({ where: { id: banGiao.id } });
    const conDon = await testPrisma.roomBooking.findUnique({ where: { id: don.id } });
    expect(conBanGiao).not.toBeNull();
    expect(conBanGiao?.conditionNote).toBe('Phòng sạch');
    expect(conDon).not.toBeNull();
  });

  it('theo thời hạn RIÊNG của phòng, không phải bản mặc định', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    // Phòng này chỉ giữ 3 tháng.
    await testPrisma.roomBookingSetting.create({
      data: { roomId: room.id, photoRetentionMonths: 3 },
    });
    const { anh } = await taoAnh(room.id, gv.user.id, 5);

    const res = await chay(CRON_SECRET);

    expect(res.body.data.purged).toBe(1);
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: anh.id } })).toBeNull();
  });

  it('đặt thời hạn 0 tháng nghĩa là GIỮ VĨNH VIỄN, không phải xoá sạch', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    await testPrisma.roomBookingSetting.create({
      data: { roomId: room.id, photoRetentionMonths: 0 },
    });
    const { anh } = await taoAnh(room.id, gv.user.id, 60);

    const res = await chay(CRON_SECRET);

    expect(res.body.data.purged).toBe(0);
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: anh.id } })).not.toBeNull();
  });

  it('chỉ dọn ảnh quá hạn, ảnh mới trong cùng lượt vẫn còn', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    const cu = await taoAnh(room.id, gv.user.id, 14);
    const moi = await taoAnh(room.id, gv.user.id, 2);

    const res = await chay(CRON_SECRET);

    expect(res.body.data.purged).toBe(1);
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: cu.anh.id } })).toBeNull();
    expect(await testPrisma.handoverPhoto.findUnique({ where: { id: moi.anh.id } })).not.toBeNull();
  });

  it('ghi vào nhật ký', async () => {
    const room = await createTestRoom();
    const gv = await loginAs('TEACHER');
    await taoAnh(room.id, gv.user.id, 14);

    await chay(CRON_SECRET);

    const nhatKy = await testPrisma.auditLog.findFirst({
      where: { action: 'HANDOVER_PHOTO_PURGE' },
    });
    expect(nhatKy).not.toBeNull();
    expect((nhatKy?.metadata as { purged?: number } | null)?.purged).toBe(1);
  });
});
