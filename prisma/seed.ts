import { PrismaClient } from '@prisma/client';
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

  console.log('✅ Seed hoàn thành:');
  console.log(`   Admin   : ${admin.email}`);
  console.log(`   Teacher : ${teacher.email}`);
  console.log(`   Student : ${student.email}`);
  console.log('   Password: Admin@123 (tất cả)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
