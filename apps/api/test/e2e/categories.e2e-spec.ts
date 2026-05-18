import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import { createTestCategory, createTestUser } from '../factories';
import { testPrisma } from '../db';

describe('Categories API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function adminCookie() {
    const admin = await createTestUser({ role: 'ADMIN' });
    const token = await signTestToken({ userId: admin.id, email: admin.email, role: 'ADMIN' });
    return cookieHeader(token);
  }

  async function teacherCookie() {
    const teacher = await createTestUser({ role: 'TEACHER' });
    const token = await signTestToken({
      userId: teacher.id,
      email: teacher.email,
      role: 'TEACHER',
    });
    return cookieHeader(token);
  }

  async function studentCookie() {
    const student = await createTestUser({ role: 'STUDENT' });
    const token = await signTestToken({
      userId: student.id,
      email: student.email,
      role: 'STUDENT',
    });
    return cookieHeader(token);
  }

  describe('GET /api/v1/categories/tree', () => {
    it('200 — trả về cây rỗng khi chưa có danh mục', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('200 — trả về cây nested 3 cấp (Năm → Khối → Lớp)', async () => {
      const year = await createTestCategory({ name: '2025-2026' });
      const grade = await createTestCategory({ name: 'Khối 10', parentId: year.id });
      await createTestCategory({ name: '10E1', parentId: grade.id });
      await createTestCategory({ name: '10E2', parentId: grade.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      const tree = res.body.data as Array<{
        name: string;
        children: Array<{ name: string; children: Array<{ name: string }> }>;
      }>;
      expect(tree).toHaveLength(1);
      expect(tree[0]!.name).toBe('2025-2026');
      expect(tree[0]!.children).toHaveLength(1);
      expect(tree[0]!.children[0]!.name).toBe('Khối 10');
      expect(tree[0]!.children[0]!.children.map((c) => c.name).sort()).toEqual(['10E1', '10E2']);
    });

    it('200 — loại trừ danh mục đã soft delete', async () => {
      const cat = await createTestCategory({ name: 'Will be deleted' });
      await testPrisma.courseCategory.update({
        where: { id: cat.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/categories?parentId=...', () => {
    it('200 — parentId=null trả về roots', async () => {
      const root1 = await createTestCategory({ name: 'Root A' });
      const root2 = await createTestCategory({ name: 'Root B' });
      await createTestCategory({ name: 'Child', parentId: root1.id });

      const res = await request(app.getHttpServer())
        .get('/api/v1/categories?parentId=null')
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      const names = (res.body.data as Array<{ name: string }>).map((c) => c.name).sort();
      expect(names).toEqual([root1.name, root2.name].sort());
    });

    it('200 — parentId=<id> trả về children của parent đó', async () => {
      const parent = await createTestCategory({ name: 'Parent' });
      await createTestCategory({ name: 'Child 1', parentId: parent.id });
      await createTestCategory({ name: 'Child 2', parentId: parent.id });
      await createTestCategory({ name: 'Unrelated' }); // root khác

      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories?parentId=${parent.id}`)
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      const names = (res.body.data as Array<{ name: string }>).map((c) => c.name).sort();
      expect(names).toEqual(['Child 1', 'Child 2']);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('200 — trả về breadcrumb đầy đủ + children', async () => {
      const year = await createTestCategory({ name: '2025-2026' });
      const grade = await createTestCategory({ name: 'Khối 10', parentId: year.id });
      const leaf = await createTestCategory({ name: '10E1', parentId: grade.id });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${grade.id}`)
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(200);
      const data = res.body.data as {
        id: string;
        name: string;
        breadcrumb: Array<{ id: string; name: string }>;
        children: Array<{ id: string; name: string }>;
      };
      expect(data.name).toBe('Khối 10');
      expect(data.breadcrumb.map((b) => b.name)).toEqual(['2025-2026', 'Khối 10']);
      expect(data.children).toHaveLength(1);
      expect(data.children[0]!.id).toBe(leaf.id);
    });

    it('404 — id không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/non-existent-id')
        .set('Cookie', await studentCookie());

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/categories', () => {
    it('201 — ADMIN tạo root category thành công', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await adminCookie())
        .send({ name: '2025-2026' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('2025-2026');
      expect(res.body.data.slug).toMatch(/^2025-2026/);
      expect(res.body.data.parentId).toBeNull();
    });

    it('201 — ADMIN tạo child category với parentId', async () => {
      const parent = await createTestCategory({ name: 'Năm học' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await adminCookie())
        .send({ name: 'Khối 10', parentId: parent.id });

      expect(res.status).toBe(201);
      expect(res.body.data.parentId).toBe(parent.id);
    });

    it('403 — TEACHER không có quyền tạo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await teacherCookie())
        .send({ name: 'Forbidden' });

      expect(res.status).toBe(403);
    });

    it('403 — STUDENT không có quyền tạo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await studentCookie())
        .send({ name: 'Forbidden' });

      expect(res.status).toBe(403);
    });

    it('400 — parentId không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await adminCookie())
        .send({ name: 'X', parentId: 'non-existent-parent' });

      expect(res.status).toBe(400);
    });

    it('400 — tên rỗng bị Zod reject', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', await adminCookie())
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('201 — tự đánh số slug khi trùng tên trong cùng parent', async () => {
      const cookie = await adminCookie();
      const first = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', cookie)
        .send({ name: 'Khối 10' });
      const second = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Cookie', cookie)
        .send({ name: 'Khối 10' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.data.slug).not.toBe(first.body.data.slug);
      expect(second.body.data.slug).toMatch(/-\d+$/);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('200 — ADMIN rename', async () => {
      const cat = await createTestCategory({ name: 'Old name' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await adminCookie())
        .send({ name: 'New name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New name');
    });

    it('200 — ADMIN di chuyển sang parent mới', async () => {
      const parentA = await createTestCategory({ name: 'A' });
      const parentB = await createTestCategory({ name: 'B' });
      const child = await createTestCategory({ name: 'Child', parentId: parentA.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${child.id}`)
        .set('Cookie', await adminCookie())
        .send({ parentId: parentB.id });

      expect(res.status).toBe(200);
      expect(res.body.data.parentId).toBe(parentB.id);
    });

    it('400 — không thể đặt parent là chính nó', async () => {
      const cat = await createTestCategory({ name: 'Self' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await adminCookie())
        .send({ parentId: cat.id });

      expect(res.status).toBe(400);
    });

    it('400 — không thể di chuyển vào con cháu của mình (circular)', async () => {
      const root = await createTestCategory({ name: 'Root' });
      const child = await createTestCategory({ name: 'Child', parentId: root.id });
      const grandchild = await createTestCategory({ name: 'GC', parentId: child.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${root.id}`)
        .set('Cookie', await adminCookie())
        .send({ parentId: grandchild.id });

      expect(res.status).toBe(400);
    });

    it('403 — TEACHER không update được', async () => {
      const cat = await createTestCategory({ name: 'Protected' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await teacherCookie())
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('200 — ADMIN xoá leaf trống thành công (soft delete)', async () => {
      const cat = await createTestCategory({ name: 'To delete' });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await adminCookie());

      expect(res.status).toBe(200);
      const after = await testPrisma.courseCategory.findUnique({ where: { id: cat.id } });
      expect(after?.deletedAt).not.toBeNull();
    });

    it('409 — chặn xoá nếu còn children', async () => {
      const parent = await createTestCategory({ name: 'Parent' });
      await createTestCategory({ name: 'Blocker', parentId: parent.id });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${parent.id}`)
        .set('Cookie', await adminCookie());

      expect(res.status).toBe(409);
    });

    it('409 — chặn xoá nếu còn course', async () => {
      const cat = await createTestCategory({ name: 'Has course' });
      const owner = await createTestUser({ role: 'TEACHER' });
      await testPrisma.course.create({
        data: {
          name: 'Blocking course',
          slug: `block-${Date.now()}`,
          ownerId: owner.id,
          categoryId: cat.id,
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await adminCookie());

      expect(res.status).toBe(409);
    });

    it('403 — TEACHER không xoá được', async () => {
      const cat = await createTestCategory({ name: 'Protected' });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${cat.id}`)
        .set('Cookie', await teacherCookie());

      expect(res.status).toBe(403);
    });
  });
});
