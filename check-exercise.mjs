import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const ex = await p.codeExercise.findUnique({
  where: { id: 'cmolpz9zt0007fzudb039jg1z' },
  include: { course: { select: { id: true, slug: true, name: true } } },
});

console.log('Exercise:', JSON.stringify(ex, null, 2));

const course = await p.course.findFirst({
  where: { slug: 'tin-hoc-10' },
  select: { id: true, slug: true, name: true },
});

console.log('Course tin-hoc-10:', JSON.stringify(course, null, 2));

if (ex && course) {
  console.log('\nMatch?', ex.courseId === course.id);
}

await p.$disconnect();
