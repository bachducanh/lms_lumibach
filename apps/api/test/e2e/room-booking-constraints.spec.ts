import { describe, expect, it } from 'vitest';
import { testPrisma } from '../db';
import { createTestRoom, createTestRoomBooking, createTestUser } from '../factories';

/**
 * Ràng buộc chống trùng lịch nằm ở TẦNG CSDL (EXCLUDE USING gist, khai bằng SQL
 * tay trong migration). Bộ test này bắn thẳng vào Prisma, không qua service —
 * mục đích là chứng minh lớp phòng thủ cuối cùng còn nguyên, kể cả khi logic ở
 * service bị viết sai hoặc bị bỏ qua ở phase sau.
 *
 * Lưu ý: chạy được bộ này đòi hỏi DB test dựng bằng `prisma migrate deploy`
 * (xem script test:db:up). `prisma db push` bỏ qua file migration nên sẽ không
 * có ràng buộc và mọi test dưới đây sẽ đỏ.
 */

const T = (iso: string) => new Date(iso);

/** 09:00–10:00 giờ Việt Nam của ngày 01/09/2026, quy về UTC. */
const NGAY = '2026-09-01';
const gio = (h: string) => T(`${NGAY}T${h}:00+07:00`);

async function chuanBi() {
  const room = await createTestRoom();
  const user = await createTestUser({ role: 'TEACHER' });
  return { room, user };
}

describe('RoomBooking_no_overlap — chặn trùng giờ ở tầng CSDL', () => {
  it('hai khung giờ liền kề trong cùng phòng đều đặt được (khoảng nửa mở)', async () => {
    const { room, user } = await chuanBi();

    await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('10:00'),
        endAt: gio('11:00'),
      })
    ).resolves.toBeDefined();
  });

  it('khung giờ chồng lấn trong cùng phòng bị từ chối', async () => {
    const { room, user } = await chuanBi();

    await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('09:30'),
        endAt: gio('10:30'),
      })
    ).rejects.toThrow();
  });

  it('đơn CHỜ DUYỆT vẫn giữ chỗ — người thứ hai không chen vào được', async () => {
    const { room, user } = await chuanBi();
    const nguoiKhac = await createTestUser({ role: 'TEACHER' });

    await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('13:00'),
      endAt: gio('15:00'),
      status: 'PENDING',
    });

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: nguoiKhac.id,
        startAt: gio('14:00'),
        endAt: gio('16:00'),
        status: 'PENDING',
      })
    ).rejects.toThrow();
  });

  it('cùng khung giờ nhưng KHÁC phòng thì không tính là trùng', async () => {
    const { user } = await chuanBi();
    const phongA = await createTestRoom();
    const phongB = await createTestRoom();

    await createTestRoomBooking({
      roomId: phongA.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });

    await expect(
      createTestRoomBooking({
        roomId: phongB.id,
        userId: user.id,
        startAt: gio('09:00'),
        endAt: gio('10:00'),
      })
    ).resolves.toBeDefined();
  });

  it.each(['CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW'] as const)(
    'đơn ở trạng thái %s không còn giữ chỗ, khung giờ đó đặt lại được',
    async (status) => {
      const { room, user } = await chuanBi();

      await createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('09:00'),
        endAt: gio('10:00'),
        status,
      });

      await expect(
        createTestRoomBooking({
          roomId: room.id,
          userId: user.id,
          startAt: gio('09:00'),
          endAt: gio('10:00'),
          status: 'PENDING',
        })
      ).resolves.toBeDefined();
    }
  );

  it.each(['APPROVED', 'CHECKED_IN'] as const)(
    'đơn ở trạng thái %s vẫn giữ chỗ',
    async (status) => {
      const { room, user } = await chuanBi();

      await createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('09:00'),
        endAt: gio('10:00'),
        status,
      });

      await expect(
        createTestRoomBooking({
          roomId: room.id,
          userId: user.id,
          startAt: gio('09:30'),
          endAt: gio('10:30'),
          status: 'PENDING',
        })
      ).rejects.toThrow();
    }
  );

  it('huỷ đơn cũ thì khung giờ được giải phóng ngay', async () => {
    const { room, user } = await chuanBi();

    const don = await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });

    await testPrisma.roomBooking.update({
      where: { id: don.id },
      data: { status: 'CANCELLED' },
    });

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('09:00'),
        endAt: gio('10:00'),
      })
    ).resolves.toBeDefined();
  });
});

describe('Các ràng buộc toàn vẹn khác', () => {
  it('không tạo được đơn có giờ kết thúc không sau giờ bắt đầu', async () => {
    const { room, user } = await chuanBi();

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('10:00'),
        endAt: gio('10:00'),
      })
    ).rejects.toThrow();

    await expect(
      createTestRoomBooking({
        roomId: room.id,
        userId: user.id,
        startAt: gio('11:00'),
        endAt: gio('10:00'),
      })
    ).rejects.toThrow();
  });

  it('một đơn chỉ có tối đa một lượt nhận phòng', async () => {
    const { room, user } = await chuanBi();
    const don = await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
      status: 'CHECKED_IN',
    });

    const banGiao = {
      bookableType: 'ROOM' as const,
      type: 'CHECKIN' as const,
      roomBookingId: don.id,
      performedById: user.id,
      conditionNote: 'Phòng sạch',
      fieldValues: { so_may: 30 },
    };

    await testPrisma.handover.create({ data: banGiao });
    await expect(testPrisma.handover.create({ data: banGiao })).rejects.toThrow();
  });

  it('lượt bàn giao không được gắn vào cả hai loại đơn cùng lúc', async () => {
    const { room, user } = await chuanBi();
    const donPhong = await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });
    const donThietBi = await testPrisma.equipmentBooking.create({
      data: {
        roomId: room.id,
        userId: user.id,
        fullName: 'Giáo viên Test',
        reason: 'Mượn máy',
        startAt: gio('09:00'),
        endAt: gio('10:00'),
      },
    });

    await expect(
      testPrisma.handover.create({
        data: {
          bookableType: 'ROOM',
          type: 'CHECKIN',
          roomBookingId: donPhong.id,
          equipmentBookingId: donThietBi.id,
          performedById: user.id,
          conditionNote: 'Sai dữ liệu',
          fieldValues: {},
        },
      })
    ).rejects.toThrow();
  });

  it('bookableType phải khớp với loại đơn thật sự được gắn', async () => {
    const { room, user } = await chuanBi();
    const donPhong = await createTestRoomBooking({
      roomId: room.id,
      userId: user.id,
      startAt: gio('09:00'),
      endAt: gio('10:00'),
    });

    await expect(
      testPrisma.handover.create({
        data: {
          bookableType: 'EQUIPMENT', // sai: khoá ngoại đang trỏ vào đơn mượn phòng
          type: 'CHECKIN',
          roomBookingId: donPhong.id,
          performedById: user.id,
          conditionNote: 'Sai loại',
          fieldValues: {},
        },
      })
    ).rejects.toThrow();
  });

  it('số lượng thiết bị trong đơn phải lớn hơn 0', async () => {
    const { room, user } = await chuanBi();
    const thietBi = await testPrisma.equipment.create({
      data: { roomId: room.id, name: 'Máy tính', unit: 'máy', totalQuantity: 10 },
    });
    const don = await testPrisma.equipmentBooking.create({
      data: {
        roomId: room.id,
        userId: user.id,
        fullName: 'Giáo viên Test',
        reason: 'Mượn máy',
        startAt: gio('09:00'),
        endAt: gio('10:00'),
      },
    });

    await expect(
      testPrisma.equipmentBookingItem.create({
        data: { equipmentBookingId: don.id, equipmentId: thietBi.id, quantity: 0 },
      })
    ).rejects.toThrow();
  });
});
