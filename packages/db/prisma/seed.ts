import { PrismaClient } from '../generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@lumibach.local' },
    update: {},
    create: {
      email: 'admin@lumibach.local',
      username: 'admin',
      passwordHash,
      firstName: 'Admin',
      lastName: 'LumiBach',
      fullName: 'LumiBach Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@lumibach.local' },
    update: {},
    create: {
      email: 'teacher@lumibach.local',
      username: 'teacher01',
      passwordHash,
      firstName: 'Nguyễn',
      lastName: 'Văn A',
      fullName: 'Nguyễn Văn A',
      role: 'TEACHER',
      status: 'ACTIVE',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@lumibach.local' },
    update: {},
    create: {
      email: 'student@lumibach.local',
      username: 'student01',
      passwordHash,
      firstName: 'Trần',
      lastName: 'Thị B',
      fullName: 'Trần Thị B',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  });

  const rooms = await seedFunctionRooms(admin.id);

  console.log('✅ Seed hoàn thành:');
  console.log(`   Admin   : ${admin.email}`);
  console.log(`   Teacher : ${teacher.email}`);
  console.log(`   Student : ${student.email}`);
  console.log('   Password: Admin@123 (tất cả)');
  console.log(`   Phòng chức năng: ${rooms.join(', ')}`);
}

/**
 * Dữ liệu mẫu cho module Phòng chức năng: 2 phòng tin học, thiết bị, nội quy
 * bản đầu tiên, trường bàn giao dùng chung và tham số đặt phòng mặc định.
 *
 * Chạy lại nhiều lần được (upsert theo khoá tự nhiên) nên không nhân bản dữ liệu.
 */
async function seedFunctionRooms(adminId: string): Promise<string[]> {
  // Bản cấu hình mặc định toàn hệ thống — mọi phòng chưa có cấu hình riêng đều
  // rơi về bản này. Chỉ được tồn tại đúng một dòng (unique index trong migration).
  const globalSetting = await prisma.roomBookingSetting.findFirst({ where: { roomId: null } });
  if (!globalSetting) {
    await prisma.roomBookingSetting.create({
      data: { roomId: null, maxDurationMinutes: 300, allowWeekend: true },
    });
  } else {
    await prisma.roomBookingSetting.update({
      where: { id: globalSetting.id },
      data: { maxDurationMinutes: 300, allowWeekend: true },
    });
  }

  const roomSeeds = [
    {
      code: 'tin-hoc-1',
      name: 'Phòng Tin học 1',
      location: 'Tầng 2, dãy A',
      capacity: 40,
      description: 'Phòng máy Windows, 40 máy trạm.',
      sortOrder: 1,
      equipment: [
        { name: 'Máy tính Windows', code: 'PC-WIN', unit: 'máy', totalQuantity: 40 },
        { name: 'Chuột dự phòng', code: 'MOUSE', unit: 'cái', totalQuantity: 15 },
        { name: 'Bàn phím dự phòng', code: 'KEYBOARD', unit: 'cái', totalQuantity: 10 },
        { name: 'Dây HDMI', code: 'HDMI', unit: 'sợi', totalQuantity: 5 },
      ],
    },
    {
      code: 'tin-hoc-2',
      name: 'Phòng Tin học 2',
      location: 'Tầng 2, dãy B',
      capacity: 30,
      description: 'Phòng máy MacBook, 30 máy.',
      sortOrder: 2,
      equipment: [
        { name: 'MacBook', code: 'MBP', unit: 'máy', totalQuantity: 30 },
        { name: 'Sạc MacBook', code: 'MBP-CHARGER', unit: 'cái', totalQuantity: 30 },
        { name: 'Chuột không dây', code: 'MOUSE-BT', unit: 'cái', totalQuantity: 20 },
        { name: 'Adapter USB-C', code: 'ADAPTER', unit: 'cái', totalQuantity: 8 },
      ],
    },
  ];

  const codes: string[] = [];

  for (const seed of roomSeeds) {
    const { equipment, ...roomData } = seed;

    const room = await prisma.functionRoom.upsert({
      where: { code: seed.code },
      update: {},
      create: roomData,
    });
    codes.push(room.code);

    for (const item of equipment) {
      const existing = await prisma.equipment.findFirst({
        where: { roomId: room.id, name: item.name },
      });
      if (!existing) {
        await prisma.equipment.create({ data: { ...item, roomId: room.id } });
      }
    }

    const hasRule = await prisma.roomRule.findFirst({ where: { roomId: room.id } });
    if (!hasRule) {
      await prisma.roomRule.create({
        data: {
          roomId: room.id,
          version: 1,
          updatedById: adminId,
          content: SAMPLE_RULE_HTML(room.name),
        },
      });
    }
  }

  // Trường bàn giao dùng chung cho mọi phòng (roomId = null).
  const sharedFields = [
    {
      key: 'so_may_hoat_dong',
      label: 'Số máy hoạt động bình thường',
      dataType: 'NUMBER' as const,
      isRequired: true,
      sortOrder: 1,
    },
    {
      key: 'so_chuot',
      label: 'Số chuột',
      dataType: 'NUMBER' as const,
      isRequired: true,
      sortOrder: 2,
    },
    {
      key: 'so_ban_phim',
      label: 'Số bàn phím',
      dataType: 'NUMBER' as const,
      isRequired: true,
      sortOrder: 3,
    },
    {
      key: 'may_chieu_hoat_dong',
      label: 'Máy chiếu hoạt động',
      dataType: 'BOOLEAN' as const,
      isRequired: false,
      sortOrder: 4,
    },
    {
      key: 've_sinh_phong',
      label: 'Tình trạng vệ sinh',
      dataType: 'SELECT' as const,
      options: ['Sạch', 'Bình thường', 'Cần dọn'],
      isRequired: false,
      sortOrder: 5,
    },
  ];

  for (const field of sharedFields) {
    // Không upsert theo @@unique([roomId, key]) được: roomId ở đây là NULL, mà
    // Postgres coi mỗi NULL là một giá trị khác nhau nên unique không bắt.
    const existing = await prisma.handoverField.findFirst({
      where: { roomId: null, key: field.key },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.handoverField.create({
      data: {
        roomId: null,
        key: field.key,
        label: field.label,
        dataType: field.dataType,
        options: field.options ?? undefined,
        isRequired: field.isRequired,
        appliesTo: 'BOTH',
        sortOrder: field.sortOrder,
      },
    });
  }

  return codes;
}

const SAMPLE_RULE_HTML = (roomName: string) =>
  `
<h3>Nội quy ${roomName}</h3>
<ol>
  <li>Chỉ sử dụng phòng trong khung giờ đã được duyệt.</li>
  <li>Nhận chìa khoá tại phòng Quản trị viên trước giờ sử dụng.</li>
  <li>Kiểm đếm thiết bị khi nhận phòng và khi trả phòng, chụp ảnh minh chứng.</li>
  <li>Không tự ý di chuyển máy móc, thiết bị ra khỏi phòng.</li>
  <li>Tắt toàn bộ máy, điều hoà, đèn và đóng cửa sổ trước khi rời phòng.</li>
  <li>Báo ngay cho Quản trị viên nếu phát hiện thiết bị hỏng hoặc mất.</li>
  <li>Trả chìa khoá cho Quản trị viên ngay sau khi kết thúc buổi sử dụng.</li>
</ol>
`.trim();

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
