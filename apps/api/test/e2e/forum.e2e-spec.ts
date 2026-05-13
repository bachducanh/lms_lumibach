import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestUser } from '../factories';
import { testPrisma } from '../db';

describe('Forum API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedCourse(ownerId: string) {
    return testPrisma.course.create({
      data: {
        name: 'Test Course',
        slug: `course-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: 'desc',
        ownerId,
      },
    });
  }

  async function enrollUser(courseId: string, userId: string) {
    return testPrisma.enrollment.create({
      data: { courseId, userId, status: 'ACTIVE' },
    });
  }

  async function seedTopic(
    courseId: string,
    authorId: string,
    opts?: { isPinned?: boolean; isLocked?: boolean }
  ) {
    const topic = await testPrisma.forumTopic.create({
      data: { courseId, authorId, title: 'Test topic', ...opts },
    });
    await testPrisma.forumPost.create({
      data: { topicId: topic.id, authorId, content: 'Initial post content' },
    });
    return topic;
  }

  // ── GET /forum/topics ─────────────────────────────────────────

  describe('GET /forum/topics', () => {
    it('200 — trả về topics của course (enrolled student)', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      await seedTopic(course.id, teacher.id);
      await seedTopic(course.id, student.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/forum/topics?courseId=${course.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        isPinned: expect.any(Boolean),
        isLocked: expect.any(Boolean),
        author: expect.objectContaining({ id: expect.any(String) }),
        _count: expect.objectContaining({ posts: expect.any(Number) }),
      });
    });

    it('403 — student không enrolled bị từ chối', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const stranger = await createTestUser();
      const course = await seedCourse(teacher.id);
      const token = await signTestToken({ userId: stranger.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/forum/topics?courseId=${course.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });

    it('200 — TEACHER truy cập không cần enroll', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const course = await seedCourse(teacher.id);
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/forum/topics?courseId=${course.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
    });

    it('400 — thiếu courseId', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/forum/topics')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(400);
    });
  });

  // ── GET /forum/topics/:id ─────────────────────────────────────

  describe('GET /forum/topics/:id', () => {
    it('200 — trả về topic detail với posts', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: topic.id,
        title: 'Test topic',
        posts: expect.any(Array),
        course: expect.objectContaining({ id: course.id }),
      });
    });

    it('404 — topic không tồn tại', async () => {
      const user = await createTestUser();
      const token = await signTestToken({ userId: user.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/forum/topics/nonexistent-id')
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(404);
    });

    it('403 — student không enrolled bị từ chối', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const stranger = await createTestUser();
      const course = await seedCourse(teacher.id);
      const topic = await seedTopic(course.id, teacher.id);
      const token = await signTestToken({ userId: stranger.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });
  });

  // ── POST /forum/topics ────────────────────────────────────────

  describe('POST /forum/topics', () => {
    it('201 — tạo topic thành công', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/forum/topics')
        .set('Cookie', cookieHeader(token))
        .send({ courseId: course.id, title: 'Câu hỏi hay', content: 'Nội dung chi tiết ở đây' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ topicId: expect.any(String) });

      const saved = await testPrisma.forumTopic.findUnique({
        where: { id: res.body.data.topicId },
      });
      expect(saved?.title).toBe('Câu hỏi hay');
    });

    it('400 — title quá ngắn', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/forum/topics')
        .set('Cookie', cookieHeader(token))
        .send({ courseId: course.id, title: 'Hi', content: 'Nội dung chi tiết ở đây' });

      expect(res.status).toBe(400);
    });

    it('403 — student không enrolled bị từ chối', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const stranger = await createTestUser();
      const course = await seedCourse(teacher.id);
      const token = await signTestToken({ userId: stranger.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/forum/topics')
        .set('Cookie', cookieHeader(token))
        .send({ courseId: course.id, title: 'Câu hỏi hay', content: 'Nội dung chi tiết ở đây' });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /forum/topics/:id ───────────────────────────────────

  describe('PATCH /forum/topics/:id', () => {
    it('200 — TEACHER pin topic', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const course = await seedCourse(teacher.id);
      const topic = await seedTopic(course.id, teacher.id);
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token))
        .send({ isPinned: true });

      expect(res.status).toBe(200);
      const updated = await testPrisma.forumTopic.findUnique({ where: { id: topic.id } });
      expect(updated?.isPinned).toBe(true);
    });

    it('403 — STUDENT không thể pin', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token))
        .send({ isPinned: true });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /forum/topics/:id ──────────────────────────────────

  describe('DELETE /forum/topics/:id', () => {
    it('200 — tác giả xoá được topic của mình', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, student.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      const deleted = await testPrisma.forumTopic.findUnique({ where: { id: topic.id } });
      expect(deleted).toBeNull();
    });

    it('403 — student khác không xoá được', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const author = await createTestUser();
      const other = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, author.id);
      await enrollUser(course.id, other.id);
      const topic = await seedTopic(course.id, author.id);
      const token = await signTestToken({ userId: other.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/forum/topics/${topic.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });
  });

  // ── POST /forum/posts ─────────────────────────────────────────

  describe('POST /forum/posts', () => {
    it('201 — tạo post reply thành công', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id);
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/forum/posts')
        .set('Cookie', cookieHeader(token))
        .send({ topicId: topic.id, content: 'Câu trả lời của tôi' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ postId: expect.any(String) });
    });

    it('403 — không đăng vào topic đã bị khoá (student)', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id, { isLocked: true });
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/forum/posts')
        .set('Cookie', cookieHeader(token))
        .send({ topicId: topic.id, content: 'Trả lời khi locked' });

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /forum/posts/:id/answer ────────────────────────────

  describe('PATCH /forum/posts/:id/answer', () => {
    it('200 — TEACHER đánh dấu answer', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id);
      const post = await testPrisma.forumPost.create({
        data: { topicId: topic.id, authorId: student.id, content: 'Good answer' },
      });
      const token = await signTestToken({ userId: teacher.id, role: 'TEACHER' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/forum/posts/${post.id}/answer`)
        .set('Cookie', cookieHeader(token))
        .send({ isAnswer: true });

      expect(res.status).toBe(200);
      const updated = await testPrisma.forumPost.findUnique({ where: { id: post.id } });
      expect(updated?.isAnswer).toBe(true);
    });

    it('403 — student ngẫu nhiên không thể đánh dấu', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const author = await createTestUser();
      const other = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, author.id);
      await enrollUser(course.id, other.id);
      const topic = await seedTopic(course.id, author.id);
      const post = await testPrisma.forumPost.create({
        data: { topicId: topic.id, authorId: other.id, content: 'An answer' },
      });
      const token = await signTestToken({ userId: other.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/forum/posts/${post.id}/answer`)
        .set('Cookie', cookieHeader(token))
        .send({ isAnswer: true });

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /forum/posts/:id ───────────────────────────────────

  describe('DELETE /forum/posts/:id', () => {
    it('200 — tác giả xoá được post của mình', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const student = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, student.id);
      const topic = await seedTopic(course.id, teacher.id);
      const post = await testPrisma.forumPost.create({
        data: { topicId: topic.id, authorId: student.id, content: 'My post' },
      });
      const token = await signTestToken({ userId: student.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/forum/posts/${post.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(200);
      const deleted = await testPrisma.forumPost.findUnique({ where: { id: post.id } });
      expect(deleted).toBeNull();
    });

    it('403 — student khác không xoá được post người khác', async () => {
      const teacher = await createTestUser({ role: 'TEACHER' });
      const author = await createTestUser();
      const other = await createTestUser();
      const course = await seedCourse(teacher.id);
      await enrollUser(course.id, author.id);
      await enrollUser(course.id, other.id);
      const topic = await seedTopic(course.id, teacher.id);
      const post = await testPrisma.forumPost.create({
        data: { topicId: topic.id, authorId: author.id, content: 'Author post' },
      });
      const token = await signTestToken({ userId: other.id, role: 'STUDENT' });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/forum/posts/${post.id}`)
        .set('Cookie', cookieHeader(token));

      expect(res.status).toBe(403);
    });
  });
});
