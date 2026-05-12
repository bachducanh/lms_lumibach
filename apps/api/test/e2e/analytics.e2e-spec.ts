import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestCourse, createTestUser } from '../factories';

describe('Analytics API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /analytics/admin-overview', () => {
    it('200 — ADMIN nhận shape đầy đủ kể cả khi DB rỗng', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/admin-overview')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.totals).toMatchObject({
        users: expect.any(Number),
        activeUsers7: expect.any(Number),
        courses: expect.any(Number),
      });
      expect(data.byRole).toBeInstanceOf(Array);
      expect(data.dailyActivity30).toHaveLength(30);
      expect(data.dailyActiveUsers30).toHaveLength(30);
      expect(data.dailySubmissions30).toHaveLength(30);
      expect(data.topCourses).toBeInstanceOf(Array);
      expect(data.topStudents).toBeInstanceOf(Array);
      expect(data.actionBreakdown).toBeInstanceOf(Array);
    });

    it('403 — TEACHER không phải ADMIN', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/admin-overview')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /analytics/course/:courseSlug', () => {
    it('200 — TEACHER owner nhận đủ shape', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const course = await createTestCourse({ ownerId: teacher.id, slug: `c-${Date.now()}` });
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.course).toMatchObject({ id: course.id, slug: course.slug });
      expect(data.totals).toMatchObject({
        enrolled: 0,
        activeStudents7: 0,
        quizAttempts: 0,
      });
      expect(data.dailyActivity30).toHaveLength(30);
      expect(data.quizScoreDist).toHaveLength(5);
    });

    it('404 — TEACHER khác không xem được course không sở hữu', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const other = await createTestUser({ role: 'TEACHER' });
      const course = await createTestCourse({ ownerId: owner.id, slug: `c-${Date.now()}` });
      const token = await signTestToken({ userId: other.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(404);
    });

    it('403 — STUDENT không có quyền', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser({ role: 'STUDENT' });
      const course = await createTestCourse({ ownerId: teacher.id, slug: `c-${Date.now()}` });
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });

    it('404 — slug không tồn tại', async () => {
      const admin = await createTestUser({ role: 'ADMIN' });
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/course/nonexistent-${Date.now()}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(404);
    });
  });
});
