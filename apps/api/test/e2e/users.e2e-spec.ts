import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestCourse, createTestUser } from '../factories';
import { testPrisma } from '../db';

describe('Users API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps import result payloads that contain numeric success', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const token = await signTestToken({
      userId: admin.id,
      email: admin.email,
      role: 'ADMIN',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/users/import')
      .set('Cookie', cookieHeader(token))
      .send({
        rows: [
          {
            fullName: 'Import User',
            email: 'import-user@example.com',
            role: 'STUDENT',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.success).toBe(1);
    expect(res.body.data.passwords[0].email).toBe('import-user@example.com');

    const imported = await testPrisma.user.findUnique({
      where: { email: 'import-user@example.com' },
    });
    expect(imported).not.toBeNull();
  });

  it('hard deletes users and reassigns owned courses to the admin', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const teacher = await createTestUser({ role: 'TEACHER' });
    const course = await createTestCourse({ ownerId: teacher.id });
    const token = await signTestToken({
      userId: admin.id,
      email: admin.email,
      role: 'ADMIN',
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/users/${teacher.id}`)
      .set('Cookie', cookieHeader(token));

    expect(res.status).toBe(200);

    const deletedUser = await testPrisma.user.findUnique({ where: { id: teacher.id } });
    expect(deletedUser).toBeNull();

    const reassignedCourse = await testPrisma.course.findUnique({ where: { id: course.id } });
    expect(reassignedCourse?.ownerId).toBe(admin.id);
  });
});
