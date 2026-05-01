const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.codeExercise.findUnique({
  where: { id: 'cmolpz9zt0007fzudb039jg1z' },
  select: {
    id: true,
    courseId: true,
    title: true,
    status: true,
    deletedAt: true,
    language: true,
  },
}).then(function(ex) {
  console.log('Full exercise record:', JSON.stringify(ex, null, 2));
  // Now try the same query as getExerciseAction
  return p.codeExercise.findUnique({
    where: { id: 'cmolpz9zt0007fzudb039jg1z', deletedAt: null },
    include: { testCases: { orderBy: { position: 'asc' } } },
  });
}).then(function(ex) {
  console.log('\ngetExerciseAction result (null = 404):', ex ? 'FOUND' : 'NULL (404!)');
}).finally(function() { p.$disconnect(); });
