import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import { cookieHeader, signTestToken } from '../helpers/sign-test-token';
import {
  createTestCategory,
  createTestCourse,
  createTestEnrollment,
  createTestUser,
} from '../factories';
import { testPrisma } from '../db';

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

  /** Khoá học có đủ chương / bài giảng / bài tập / ghi danh để kiểm tra xoá. */
  async function seedCourseWithContent(ownerId: string) {
    const student = await createTestUser({ role: 'STUDENT' });
    const course = await createTestCourse({ ownerId });
    await createTestEnrollment({ userId: student.id, courseId: course.id });

    const mod = await testPrisma.module.create({
      data: { courseId: course.id, name: 'Chương 1', position: 0 },
    });
    const lesson = await testPrisma.lesson.create({
      data: { title: 'Bài 1', content: '<p>Nội dung</p>', createdBy: ownerId },
    });
    const item = await testPrisma.moduleItem.create({
      data: { moduleId: mod.id, type: 'LESSON', position: 0, title: 'Bài 1', lessonId: lesson.id },
    });
    const assignment = await testPrisma.assignment.create({
      data: {
        courseId: course.id,
        title: 'Bài tập 1',
        instructions: 'Làm bài',
        createdBy: ownerId,
      },
    });

    return { course, mod, item, lesson, assignment, student };
  }

  /**
   * Thêm hoạt động thật của học sinh vào khoá: lượt làm quiz có câu trả lời,
   * bài nộp code có kết quả test case, lượt làm đề luyện tập, và điểm rubric.
   *
   * Đây là các bảng nằm ở giao của hai nhánh cascade, nhánh trỏ tới phần định
   * nghĩa đề khai RESTRICT — chính là thứ làm xoá vĩnh viễn fail P2003.
   */
  async function seedStudentActivity(courseId: string, ownerId: string, studentId: string) {
    const quiz = await testPrisma.quiz.create({
      data: { courseId, title: 'Quiz 1', createdBy: ownerId },
    });
    const question = await testPrisma.question.create({
      data: { courseId, type: 'TRUE_FALSE', content: '1 + 1 = 2?', createdBy: ownerId },
    });
    await testPrisma.quizQuestion.create({ data: { quizId: quiz.id, questionId: question.id } });
    const attempt = await testPrisma.quizAttempt.create({ data: { quizId: quiz.id, studentId } });
    await testPrisma.answer.create({
      data: { attemptId: attempt.id, questionId: question.id, booleanAnswer: true },
    });

    const exercise = await testPrisma.codeExercise.create({
      data: { courseId, title: 'Bài code', language: 'PYTHON3', createdBy: ownerId },
    });
    const testCase = await testPrisma.testCase.create({
      data: { codeExerciseId: exercise.id, input: '1', expectedOutput: '1' },
    });
    const codeSub = await testPrisma.codeSubmission.create({
      data: { codeExerciseId: exercise.id, studentId, language: 'PYTHON3', code: 'print(1)' },
    });
    await testPrisma.testCaseResult.create({
      data: { submissionId: codeSub.id, testCaseId: testCase.id, status: 'ACCEPTED' },
    });

    const pt = await testPrisma.practiceTest.create({
      data: {
        courseId,
        title: 'Đề 1',
        pdfUrl: '/storage/x/y.pdf',
        pdfName: 'y.pdf',
        createdBy: ownerId,
      },
    });
    const ptQuestion = await testPrisma.practiceTestQuestion.create({
      data: { practiceTestId: pt.id, type: 'MULTIPLE_CHOICE', correctAnswer: { value: 'A' } },
    });
    const ptAttempt = await testPrisma.practiceTestAttempt.create({
      data: { practiceTestId: pt.id, studentId },
    });
    await testPrisma.practiceTestAnswer.create({
      data: { attemptId: ptAttempt.id, questionId: ptQuestion.id, selectedOption: 'A' },
    });

    return { quiz, question, exercise, practiceTest: pt };
  }

  /** Bài nộp có chấm rubric — nhánh RESTRICT còn lại. */
  async function seedRubricGrade(assignmentId: string, ownerId: string, studentId: string) {
    const submission = await testPrisma.submission.create({
      data: { assignmentId, studentId, content: 'bài làm' },
    });
    const rubric = await testPrisma.rubric.create({ data: { assignmentId } });
    const criterion = await testPrisma.rubricCriterion.create({
      data: { rubricId: rubric.id, name: 'Tiêu chí 1' },
    });
    const level = await testPrisma.rubricLevel.create({
      data: { criterionId: criterion.id, label: 'Tốt', points: 10 },
    });
    await testPrisma.rubricGrade.create({
      data: {
        submissionId: submission.id,
        criterionId: criterion.id,
        levelId: level.id,
        gradedBy: ownerId,
      },
    });
    return { submission };
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

    // Xoá = chuyển vào thùng rác. Nội dung con PHẢI còn nguyên, nếu không thì
    // nút "Khôi phục" ở thùng rác trả về một khoá học rỗng.
    it('200 — xoá chỉ đưa vào thùng rác, giữ nguyên nội dung để khôi phục', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const { course, mod, lesson, assignment } = await seedCourseWithContent(owner.id);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);

      const [courseRow, moduleLeft, lessonLeft, assignmentLeft, enrollmentLeft] = await Promise.all(
        [
          testPrisma.course.findUnique({ where: { id: course.id } }),
          testPrisma.module.findUnique({ where: { id: mod.id } }),
          testPrisma.lesson.findUnique({ where: { id: lesson.id } }),
          testPrisma.assignment.findUnique({ where: { id: assignment.id } }),
          testPrisma.enrollment.findFirst({ where: { courseId: course.id } }),
        ]
      );

      expect(courseRow?.deletedAt).toBeInstanceOf(Date);
      expect(moduleLeft).not.toBeNull();
      expect(lessonLeft).not.toBeNull();
      expect(assignmentLeft).not.toBeNull();
      expect(enrollmentLeft).not.toBeNull();
    });
  });

  describe('Thùng rác', () => {
    it('200 — khôi phục đưa khoá học trở lại danh sách', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const course = await createTestCourse({ ownerId: owner.id });

      await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie);

      const trash = await request(app.getHttpServer())
        .get('/api/v1/courses/trash')
        .set('Cookie', cookie);
      expect(trash.status).toBe(200);
      expect(trash.body.data).toHaveLength(1);
      expect(trash.body.data[0].id).toBe(course.id);
      expect(trash.body.data[0].daysLeft).toBe(30);

      const restored = await request(app.getHttpServer())
        .post(`/api/v1/courses/${course.id}/restore`)
        .set('Cookie', cookie);
      expect(restored.status).toBe(200);

      const row = await testPrisma.course.findUnique({ where: { id: course.id } });
      expect(row?.deletedAt).toBeNull();
    });

    it('403 — không xoá vĩnh viễn được khoá chưa nằm trong thùng rác', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const course = await createTestCourse({ ownerId: owner.id });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}/purge`)
        .set('Cookie', cookie);

      expect(res.status).toBe(403);
      const row = await testPrisma.course.findUnique({ where: { id: course.id } });
      expect(row).not.toBeNull();
    });

    // Đây mới là chỗ xoá thật — gồm cả Lesson, thứ mà cascade không chạm tới
    // vì ModuleItem.lessonId khai onDelete SetNull.
    it('200 — xoá vĩnh viễn dọn sạch nội dung con, không để lại bản ghi mồ côi', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const { course, mod, item, lesson, assignment } = await seedCourseWithContent(owner.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}/purge`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);

      const [courseLeft, moduleLeft, itemLeft, lessonLeft, assignmentLeft, enrollmentLeft] =
        await Promise.all([
          testPrisma.course.findUnique({ where: { id: course.id } }),
          testPrisma.module.findUnique({ where: { id: mod.id } }),
          testPrisma.moduleItem.findUnique({ where: { id: item.id } }),
          testPrisma.lesson.findUnique({ where: { id: lesson.id } }),
          testPrisma.assignment.findUnique({ where: { id: assignment.id } }),
          testPrisma.enrollment.findFirst({ where: { courseId: course.id } }),
        ]);

      expect(courseLeft).toBeNull();
      expect(moduleLeft).toBeNull();
      expect(itemLeft).toBeNull();
      expect(lessonLeft).toBeNull();
      expect(assignmentLeft).toBeNull();
      expect(enrollmentLeft).toBeNull();
    });

    // Hồi quy: khoá học có hoạt động thật của học sinh từng làm purge fail
    // P2003 (Invalid reference) vì Answer/TestCaseResult/PracticeTestAnswer/
    // RubricGrade trỏ tới phần định nghĩa đề bằng RESTRICT.
    it('200 — xoá vĩnh viễn được khoá học đã có bài làm của học sinh', async () => {
      const { user: owner, cookie } = await tokenFor('TEACHER');
      const { course, assignment, student } = await seedCourseWithContent(owner.id);
      const { question, exercise } = await seedStudentActivity(course.id, owner.id, student.id);
      await seedRubricGrade(assignment.id, owner.id, student.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}`)
        .set('Cookie', cookie);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/courses/${course.id}/purge`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(await testPrisma.course.findUnique({ where: { id: course.id } })).toBeNull();

      // Không còn bản ghi nào của khoá sót lại ở các bảng RESTRICT.
      const [answers, results, ptAnswers, grades, questions, testCases] = await Promise.all([
        testPrisma.answer.count({ where: { questionId: question.id } }),
        testPrisma.testCaseResult.count({ where: { testCase: { codeExerciseId: exercise.id } } }),
        testPrisma.practiceTestAnswer.count({
          where: { attempt: { practiceTestId: { not: '' } } },
        }),
        testPrisma.rubricGrade.count({ where: { submission: { assignmentId: assignment.id } } }),
        testPrisma.question.count({ where: { courseId: course.id } }),
        testPrisma.testCase.count({ where: { codeExerciseId: exercise.id } }),
      ]);
      expect(answers).toBe(0);
      expect(results).toBe(0);
      expect(ptAnswers).toBe(0);
      expect(grades).toBe(0);
      expect(questions).toBe(0);
      expect(testCases).toBe(0);
    });

    it('chỉ dọn khoá quá 30 ngày, giữ lại khoá mới xoá', async () => {
      const owner = await createTestUser({ role: 'TEACHER' });
      const fresh = await createTestCourse({ ownerId: owner.id });
      const stale = await createTestCourse({ ownerId: owner.id });

      await testPrisma.course.update({
        where: { id: fresh.id },
        data: { deletedAt: new Date() },
      });
      await testPrisma.course.update({
        where: { id: stale.id },
        data: { deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/courses/purge-expired')
        .set('x-cron-secret', process.env.CRON_SECRET ?? '');
      expect(res.status).toBe(200);
      expect(res.body.data.purged).toBe(1);

      expect(await testPrisma.course.findUnique({ where: { id: stale.id } })).toBeNull();
      expect(await testPrisma.course.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    });

    it('401 — cron endpoint từ chối khi sai secret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/courses/purge-expired')
        .set('x-cron-secret', 'sai-secret');

      expect(res.status).toBe(401);
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
