import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestCategory, createTestCourse, createTestUser } from '../factories';

describe('Courses API — category-aware behavior', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'TA') {
    const user = await createTestUser({ role });
    const token = await signTestToken({ userId: user.id, email: user.email, role });
    return { user, cookie: cookieHeader(token) };
  }

  describe('POST /api/v1/courses', () => {
    it('201 — ADMIN tạo course với leaf category', async () => {
      const { cookie } = await tokenFor('ADMIN');
      const cat = await createTestCategory({ name: 'Leaf' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Tin học 10', categoryId: cat.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toMatch(/^tin-hoc-10/);
    });

    it('403 — TEACHER KHÔNG được tạo course (đổi quyền từ task này)', async () => {
      const { cookie } = await tokenFor('TEACHER');
      const cat = await createTestCategory();

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Course bởi teacher', categoryId: cat.id });

      expect(res.status).toBe(403);
    });

    it('403 — STUDENT không tạo được', async () => {
      const { cookie } = await tokenFor('STUDENT');
      const cat = await createTestCategory();

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Forbidden', categoryId: cat.id });

      expect(res.status).toBe(403);
    });

    it('400 — thiếu categoryId', async () => {
      const { cookie } = await tokenFor('ADMIN');

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Missing category' });

      expect(res.status).toBe(400);
    });

    it('400 — categoryId không tồn tại', async () => {
      const { cookie } = await tokenFor('ADMIN');

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Bad cat', categoryId: 'non-existent-id' });

      expect(res.status).toBe(400);
    });

    it('400 — categoryId là non-leaf (có children)', async () => {
      const { cookie } = await tokenFor('ADMIN');
      const parent = await createTestCategory({ name: 'Năm 2025' });
      await createTestCategory({ name: 'Khối con', parentId: parent.id });

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Cookie', cookie)
        .send({ name: 'Should fail', categoryId: parent.id });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/lá/i);
    });
  });

  describe('PATCH /api/v1/courses/:id', () => {
    it('200 — owner (TEACHER) update được course mình sở hữu', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const cat = await createTestCategory();
      const course = await createTestCourse({ ownerId: owner.id, categoryId: cat.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie)
        .send({ name: 'Updated name' });

      expect(res.status).toBe(200);
    });

    it('200 — đổi sang leaf category khác thành công', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const oldCat = await createTestCategory({ name: 'Old' });
      const newCat = await createTestCategory({ name: 'New' });
      const course = await createTestCourse({ ownerId: owner.id, categoryId: oldCat.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie)
        .send({ categoryId: newCat.id });

      expect(res.status).toBe(200);
    });

    it('400 — đổi sang non-leaf category bị từ chối', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const oldCat = await createTestCategory({ name: 'Old leaf' });
      const newParent = await createTestCategory({ name: 'Has children' });
      await createTestCategory({ name: 'Child', parentId: newParent.id });
      const course = await createTestCourse({ ownerId: owner.id, categoryId: oldCat.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie)
        .send({ categoryId: newParent.id });

      expect(res.status).toBe(400);
    });

    it('403 — TEACHER khác không update được course không phải mình', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const other = await createTestUser({ role: 'TEACHER' });
      const otherToken = await signTestToken({
        userId: other.id,
        email: other.email,
        role: 'TEACHER',
      });
      const course = await createTestCourse({ ownerId: owner.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookieHeader(otherToken))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/courses/:id', () => {
    it('200 — owner xoá được course của mình', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const course = await createTestCourse({ ownerId: owner.id });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/courses (filter & response shape)', () => {
    it('200 — response item có category breadcrumb', async () => {
      const year = await createTestCategory({ name: '2025-2026' });
      const grade = await createTestCategory({ name: 'Khối 10', parentId: year.id });
      const leaf = await createTestCategory({ name: '10E1', parentId: grade.id });

      const owner = await createTestUser({ role: 'TEACHER' });
      await createTestCourse({
        ownerId: owner.id,
        categoryId: leaf.id,
        status: 'PUBLISHED',
      });

      const { cookie } = await tokenFor('ADMIN');
      const res = await request(app.getHttpServer()).get('/api/v1/courses').set('Cookie', cookie);

      expect(res.status).toBe(200);
      const courses = res.body.data.courses as Array<{
        category: { name: string; breadcrumb: Array<{ name: string }> };
      }>;
      const target = courses.find((c) => c.category.name === '10E1');
      expect(target).toBeDefined();
      expect(target!.category.breadcrumb.map((b) => b.name)).toEqual([
        '2025-2026',
        'Khối 10',
        '10E1',
      ]);
    });

    it('200 — filter ?categoryId=<leaf> chỉ trả courses thuộc leaf đó', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const leafA = await createTestCategory({ name: 'A' });
      const leafB = await createTestCategory({ name: 'B' });
      await createTestCourse({ ownerId: owner.id, categoryId: leafA.id, status: 'PUBLISHED' });
      await createTestCourse({ ownerId: owner.id, categoryId: leafA.id, status: 'PUBLISHED' });
      await createTestCourse({ ownerId: owner.id, categoryId: leafB.id, status: 'PUBLISHED' });

      const { cookie } = await tokenFor('ADMIN');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/courses?categoryId=${leafA.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filter ?categoryId=<parent>&includeSubcategories=true trả về cả subtree', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const grade = await createTestCategory({ name: 'Khối 11' });
      const class1 = await createTestCategory({ name: '11A', parentId: grade.id });
      const class2 = await createTestCategory({ name: '11B', parentId: grade.id });
      const unrelated = await createTestCategory({ name: 'Other' });
      await createTestCourse({ ownerId: owner.id, categoryId: class1.id, status: 'PUBLISHED' });
      await createTestCourse({ ownerId: owner.id, categoryId: class2.id, status: 'PUBLISHED' });
      await createTestCourse({ ownerId: owner.id, categoryId: unrelated.id, status: 'PUBLISHED' });

      const { cookie } = await tokenFor('ADMIN');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/courses?categoryId=${grade.id}&includeSubcategories=true`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
    });

    it('200 — filter ?categoryId=<parent> KHÔNG include subcategories → 0 vì không có course nào gắn trực tiếp', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const grade = await createTestCategory({ name: 'Khối 12' });
      const klass = await createTestCategory({ name: '12A', parentId: grade.id });
      await createTestCourse({ ownerId: owner.id, categoryId: klass.id, status: 'PUBLISHED' });

      const { cookie } = await tokenFor('ADMIN');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/courses?categoryId=${grade.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('GET /api/v1/courses/:slug', () => {
    it('200 — detail có category với breadcrumb đầy đủ', async () => {
      const year = await createTestCategory({ name: 'Year X' });
      const klass = await createTestCategory({ name: 'Class Y', parentId: year.id });
      const owner = await createTestUser({ role: 'ADMIN' });
      const ownerToken = await signTestToken({
        userId: owner.id,
        email: owner.email,
        role: 'ADMIN',
      });
      const course = await createTestCourse({
        ownerId: owner.id,
        categoryId: klass.id,
        slug: `detail-test-${Date.now()}`,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/courses/${course.slug}`)
        .set('Cookie', cookieHeader(ownerToken));

      expect(res.status).toBe(200);
      const detail = res.body.data as {
        category: { id: string; name: string; breadcrumb: Array<{ name: string }> };
      };
      expect(detail.category.id).toBe(klass.id);
      expect(detail.category.breadcrumb.map((b) => b.name)).toEqual(['Year X', 'Class Y']);
    });
  });
});
