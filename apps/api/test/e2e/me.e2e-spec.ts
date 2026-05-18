import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken, TEST_COOKIE_NAME } from '../helpers/sign-test-token';
import { createTestUser } from '../factories';

describe('GET /api/v1/me', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 — trả về user info khi token hợp lệ', async () => {
    const user = await createTestUser({ role: 'STUDENT', email: 'me-test@example.com' });
    const token = await signTestToken({ userId: user.id, email: user.email, role: user.role });

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookieHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        user: {
          id: user.id,
          email: 'me-test@example.com',
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      },
    });
  });

  it('401 — không gửi cookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: expect.any(String), message: expect.any(String) },
    });
  });

  it('401 — token expired', async () => {
    const user = await createTestUser();
    const expiredToken = await signTestToken({
      userId: user.id,
      exp: Math.floor(Date.now() / 1000) - 60, // exp đã qua 60s
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookieHeader(expiredToken));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — token sign bằng secret khác (sai signature)', async () => {
    const user = await createTestUser();
    const wrongSecretToken = await signTestToken({
      userId: user.id,
      secret: 'a-different-secret-32bytes-padding-padding-padding',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookieHeader(wrongSecretToken));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — token cookie name sai (salt mismatch)', async () => {
    const user = await createTestUser();
    const token = await signTestToken({ userId: user.id });

    // Token đúng nhưng đặt vào tên cookie khác → guard không tìm thấy
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', `wrong-cookie-name=${token}`);

    expect(res.status).toBe(401);
  });

  it('401 — user.status !== ACTIVE', async () => {
    const user = await createTestUser({ status: 'SUSPENDED' });
    const token = await signTestToken({ userId: user.id });

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookieHeader(token));

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('SUSPENDED');
  });

  it('GET /me/teacher-zone — 403 với STUDENT, 200 với TEACHER', async () => {
    const student = await createTestUser({ role: 'STUDENT' });
    const teacher = await createTestUser({ role: 'TEACHER' });
    const studentToken = await signTestToken({ userId: student.id, role: 'STUDENT' });
    const teacherToken = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/me/teacher-zone')
      .set('Cookie', cookieHeader(studentToken));
    expect(forbidden.status).toBe(403);

    const ok = await request(app.getHttpServer())
      .get('/api/v1/me/teacher-zone')
      .set('Cookie', cookieHeader(teacherToken));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      success: true,
      data: { ok: true, userId: teacher.id },
    });
  });
});

describe('GET /api/v1/health (public)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 — public endpoint không cần auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
  });
});
