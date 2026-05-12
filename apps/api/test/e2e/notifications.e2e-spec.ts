import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestUser } from '../factories';
import { testPrisma } from '../db';

describe('Notifications API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedNotifications(userId: string) {
    await testPrisma.notification.createMany({
      data: [
        {
          userId,
          type: 'QUIZ_GRADED',
          title: 'Quiz 1 đã chấm',
          body: 'Bạn được 8/10',
          isRead: false,
        },
        { userId, type: 'COURSE_ENROLLED', title: 'Đăng ký Course X', isRead: true },
        {
          userId,
          type: 'ASSIGNMENT_DUE_SOON',
          title: 'Hạn 24h',
          link: '/assignments/1',
          isRead: false,
        },
      ],
    });
  }

  describe('GET /notifications', () => {
    it('200 — chỉ trả về notifications của user hiện tại', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      await seedNotifications(userA.id);
      await seedNotifications(userB.id);
      const token = await signTestToken({ userId: userA.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      // Mỗi row có shape mong đợi
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        title: expect.any(String),
        isRead: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    });

    it('200 — respect limit param', async () => {
      const user = await createTestUser();
      await seedNotifications(user.id);
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=2')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('400 — limit > 100', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=999')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(400);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('200 — đếm chính xác notifications chưa đọc', async () => {
      const user = await createTestUser();
      await seedNotifications(user.id);
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2); // 3 seeded, 1 đã isRead=true
    });
  });

  describe('POST /notifications/:id/read', () => {
    it('200 — mark 1 notification là read', async () => {
      const user = await createTestUser();
      await seedNotifications(user.id);
      const notification = await testPrisma.notification.findFirst({
        where: { userId: user.id, isRead: false },
      });
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/notifications/${notification!.id}/read`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(1);

      // DB confirm
      const updated = await testPrisma.notification.findUnique({
        where: { id: notification!.id },
      });
      expect(updated?.isRead).toBe(true);
    });

    it('200 updated=0 — không mark được của user khác', async () => {
      const owner = await createTestUser();
      const attacker = await createTestUser();
      await seedNotifications(owner.id);
      const notification = await testPrisma.notification.findFirst({
        where: { userId: owner.id },
      });
      const token = await signTestToken({ userId: attacker.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/notifications/${notification!.id}/read`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(0);

      const stillUnread = await testPrisma.notification.findUnique({
        where: { id: notification!.id },
      });
      expect(stillUnread?.isRead).toBe(false);
    });
  });

  describe('POST /notifications/read-all', () => {
    it('200 — mark tất cả unread của user là read', async () => {
      const user = await createTestUser();
      await seedNotifications(user.id);
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2); // 2 unread → đọc

      const remaining = await testPrisma.notification.count({
        where: { userId: user.id, isRead: false },
      });
      expect(remaining).toBe(0);
    });
  });

  describe('GET /notifications/preferences', () => {
    it('200 — trả default khi chưa có record', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        inAppEnabled: true,
        emailEnabled: true,
        emailQuizGraded: true,
        emailAssignmentGraded: true,
      });
    });
  });

  describe('PUT /notifications/preferences', () => {
    it('200 — upsert preferences, partial OK', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Cookie', cookieHeader(token))
        .send({ emailEnabled: false, emailQuizGraded: false });

      expect(res.status).toBe(200);
      expect(res.body.data.emailEnabled).toBe(false);
      expect(res.body.data.emailQuizGraded).toBe(false);
      // Field không gửi vẫn giữ default true (vì upsert create với defaults).
      expect(res.body.data.emailAssignmentGraded).toBe(true);
    });

    it('400 — non-boolean value bị reject', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Cookie', cookieHeader(token))
        .send({ emailEnabled: 'yes' });

      expect(res.status).toBe(400);
    });
  });
});
