const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

Promise.all([
  p.course.findFirst({
    where: { slug: 'tin-hoc-10' },
    select: { id: true, slug: true, deletedAt: true },
  })
]).then(function(results) {
  console.log('Course:', results[0]);
}).finally(function() { p.$disconnect(); });
