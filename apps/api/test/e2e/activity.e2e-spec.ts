import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestCourse, createTestEnrollment, createTestUser } from '../factories';
import { testPrisma } from '../db';

describe('Activities API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seed() {
    const teacher = await createTestUser({ role: 'TEACHER' });
    const student = await createTestUser({ role: 'STUDENT' });
    const otherTeacher = await createTestUser({ role: 'TEACHER' });
    const admin = await createTestUser({ role: 'ADMIN' });

    const course = await createTestCourse({ ownerId: teacher.id, slug: `c-${Date.now()}` });
    await createTestEnrollment({ userId: student.id, courseId: course.id });

    // 3 log rows: 2 cho student, 1 cho teacher
    await testPrisma.activityLog.createMany({
      data: [
        {
          userId: student.id,
          courseId: course.id,
          action: 'VIEW_LESSON',
          resourceType: 'lesson',
          resourceName: 'Bài 1',
        },
        {
          userId: student.id,
          courseId: course.id,
          action: 'SUBMIT_QUIZ',
          resourceType: 'quiz',
          resourceName: 'Quiz 1',
        },
        { userId: teacher.id, action: 'LOGIN' },
      ],
    });

    return { teacher, student, otherTeacher, admin, course };
  }

  describe('GET /activities/student/:userId', () => {
    it('200 — TEACHER xem được logs học sinh, trả về 2 rows + total', async () => {
      const { teacher, student } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/student/${student.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ total: 2, page: 1, pages: 1 });
      expect(res.body.data.rows).toHaveLength(2);
      expect(res.body.data.rows[0].user.id).toBe(student.id);
    });

    it('403 — STUDENT không có quyền', async () => {
      const { student } = await seed();
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/student/${student.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });

    it('400 — page âm bị Zod reject', async () => {
      const { teacher, student } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/student/${student.id}?page=-1`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /activities/course/:courseSlug', () => {
    it('200 — TEACHER owner xem được course logs', async () => {
      const { teacher, course } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2); // chỉ 2 rows gắn courseId
    });

    it('404 — TEACHER khác không xem được course không sở hữu', async () => {
      const { otherTeacher, course } = await seed();
      const token = await signTestToken({ userId: otherTeacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(404);
    });

    it('200 — ADMIN xem được mọi course', async () => {
      const { admin, course } = await seed();
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/course/${course.slug}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('404 — course slug không tồn tại', async () => {
      const { teacher } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/course/nope-${Date.now()}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('GET /activities/system', () => {
    it('200 — ADMIN xem được, trả về tất cả 3 rows', async () => {
      const { admin } = await seed();
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/activities/system')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
    });

    it('403 — TEACHER không phải ADMIN', async () => {
      const { teacher } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/activities/system')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });

    it('200 — filter ?q= chỉ trả user khớp tên', async () => {
      const { admin, student } = await seed();
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities/system?q=${encodeURIComponent(student.email)}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2); // student có 2 logs
    });
  });

  describe('GET /activities/courses-filter', () => {
    it('200 — TEACHER chỉ thấy course mình sở hữu', async () => {
      const { teacher, course } = await seed();
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/activities/courses-filter')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(course.id);
    });

    it('200 — ADMIN thấy tất cả courses', async () => {
      const { admin } = await seed();
      // Tạo thêm 1 course nữa do admin sở hữu để xác nhận admin thấy >= 1
      await createTestCourse({ ownerId: admin.id, slug: `admin-c-${Date.now()}` });
      const token = await signTestToken({ userId: admin.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/activities/courses-filter')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
