import { beforeEach, describe, expect, it } from 'vitest';
import type { Cache } from 'cache-manager';
import { testPrisma } from '../db';
import { createTestCourse, createTestUser } from '../factories';
import { PracticeTestsService } from '@/modules/practice-tests/practice-tests.service';
import { QuestionsService } from '@/modules/questions/questions.service';
import { CategoryQuestionBankService } from '@/modules/questions/category-question-bank.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { CategoryBankAccessService } from '@/modules/categories/category-bank-access.service';
import { AttemptsService } from '@/modules/attempts/attempts.service';
import type { Judge0Service } from '@/common/judge0/judge0.service';
import type { AuthUser } from '@/common/auth/auth.types';

/**
 * Giáo viên sửa đề/đáp án khi học sinh đã làm bài.
 *
 * Trước đây cả hai luồng đều xoá sạch câu hỏi/đáp án rồi tạo lại:
 *  - Đề luyện tập: khoá ngoại RESTRICT làm việc lưu thất bại hoàn toàn.
 *  - Quiz: QuestionOption.id đổi hết nên bài đã nộp mất đáp án học sinh đã chọn.
 * Các test dưới đây khoá lại hành vi đúng: giữ id, giữ bài làm, chấm lại điểm.
 */

const noopCache = {
  del: async () => undefined,
} as unknown as Cache;

const noopJudge0 = {
  runCode: async () => {
    throw new Error('Judge0 không được gọi trong test này.');
  },
} as unknown as Judge0Service;

/**
 * QuestionsService cần CategoryQuestionBankService để kiểm quyền câu hỏi của
 * ngân hàng danh mục. Các test dưới đây chỉ đụng câu hỏi thuộc khoá học nên
 * nhánh đó không bao giờ chạy — dựng bản thật với phụ thuộc rỗng là đủ.
 */
function makeCategoryBank() {
  const categories = new CategoriesService(testPrisma, noopCache, {
    log: async () => undefined,
  } as never);
  return new CategoryQuestionBankService(
    testPrisma,
    new CategoryBankAccessService(testPrisma, categories)
  );
}

async function setupCourse() {
  const teacher = await createTestUser({ role: 'ADMIN' });
  const student = await createTestUser({ role: 'STUDENT' });
  const course = await createTestCourse({ ownerId: teacher.id, status: 'PUBLISHED' });
  const teacherUser: AuthUser = { id: teacher.id, role: 'ADMIN' } as AuthUser;
  const studentUser: AuthUser = { id: student.id, role: 'STUDENT' } as AuthUser;
  return { teacher, student, course, teacherUser, studentUser };
}

describe('Sửa đề luyện tập khi đã có bài làm', () => {
  let service: PracticeTestsService;

  beforeEach(() => {
    service = new PracticeTestsService(testPrisma, noopCache);
  });

  it('lưu được, giữ bài làm và chấm lại khi giáo viên sửa đáp án sai', async () => {
    const { course, teacherUser, studentUser } = await setupCourse();

    // Đề có 2 câu; đáp án câu 1 bị nhập nhầm thành B (đúng ra là A).
    const { practiceTestId } = await service.create(teacherUser, {
      courseId: course.id,
      title: 'Đề ôn tập 1',
      pdfUrl: '/storage/de-bai.pdf',
      pdfName: 'de-bai.pdf',
      publish: true,
      questions: [
        { type: 'MULTIPLE_CHOICE', points: 1, optionCount: 4, correctOption: 'B' },
        { type: 'SHORT_ANSWER', points: 1, acceptedAnswers: ['42'] },
      ],
    });

    const before = await testPrisma.practiceTestQuestion.findMany({
      where: { practiceTestId },
      orderBy: { position: 'asc' },
    });

    // Học sinh chọn A (thực tế là đáp án đúng) và trả lời đúng câu 2.
    const submitted = await service.submit(studentUser, practiceTestId, {
      answers: [
        { questionId: before[0]!.id, selectedOption: 'A' },
        { questionId: before[1]!.id, textAnswer: '42' },
      ],
    });
    expect(submitted.score).toBe(1); // câu 1 bị chấm sai vì đáp án nhập nhầm

    // Giáo viên sửa lại đáp án câu 1 thành A.
    const result = await service.update(teacherUser, practiceTestId, {
      questions: [
        { type: 'MULTIPLE_CHOICE', points: 1, optionCount: 4, correctOption: 'A' },
        { type: 'SHORT_ANSWER', points: 1, acceptedAnswers: ['42'] },
      ],
    });
    expect(result.regradedAttempts).toBe(1);

    // Câu hỏi giữ nguyên id → bài làm không bị mồ côi.
    const after = await testPrisma.practiceTestQuestion.findMany({
      where: { practiceTestId },
      orderBy: { position: 'asc' },
    });
    expect(after.map((q) => q.id)).toEqual(before.map((q) => q.id));

    // Bài làm còn nguyên và đã được chấm lại.
    const attempt = await testPrisma.practiceTestAttempt.findUniqueOrThrow({
      where: { id: submitted.attemptId },
      include: { answers: true },
    });
    expect(attempt.score).toBe(2);
    expect(attempt.maxScore).toBe(2);
    const answer1 = attempt.answers.find((a) => a.questionId === before[0]!.id);
    expect(answer1?.selectedOption).toBe('A');
    expect(answer1?.isCorrect).toBe(true);
    expect(answer1?.score).toBe(1);
  });

  it('gỡ bớt câu thì xoá luôn câu trả lời tương ứng và tính lại điểm', async () => {
    const { course, teacherUser, studentUser } = await setupCourse();

    const { practiceTestId } = await service.create(teacherUser, {
      courseId: course.id,
      title: 'Đề ôn tập 2',
      pdfUrl: '/storage/de-bai.pdf',
      pdfName: 'de-bai.pdf',
      publish: true,
      questions: [
        { type: 'MULTIPLE_CHOICE', points: 1, optionCount: 4, correctOption: 'A' },
        { type: 'MULTIPLE_CHOICE', points: 1, optionCount: 4, correctOption: 'C' },
      ],
    });
    const questions = await testPrisma.practiceTestQuestion.findMany({
      where: { practiceTestId },
      orderBy: { position: 'asc' },
    });

    const submitted = await service.submit(studentUser, practiceTestId, {
      answers: [
        { questionId: questions[0]!.id, selectedOption: 'A' },
        { questionId: questions[1]!.id, selectedOption: 'C' },
      ],
    });
    expect(submitted.score).toBe(2);

    await service.update(teacherUser, practiceTestId, {
      questions: [{ type: 'MULTIPLE_CHOICE', points: 1, optionCount: 4, correctOption: 'A' }],
    });

    const attempt = await testPrisma.practiceTestAttempt.findUniqueOrThrow({
      where: { id: submitted.attemptId },
      include: { answers: true },
    });
    expect(attempt.answers).toHaveLength(1);
    expect(attempt.score).toBe(1);
    expect(attempt.maxScore).toBe(1);
  });
});

describe('Sửa câu hỏi quiz khi đã có bài làm', () => {
  let questions: QuestionsService;
  let attempts: AttemptsService;

  beforeEach(() => {
    questions = new QuestionsService(testPrisma, noopJudge0, makeCategoryBank());
    attempts = new AttemptsService(testPrisma, noopJudge0);
  });

  it('giữ id đáp án, giữ lựa chọn của học sinh và chấm lại khi sửa đáp án đúng', async () => {
    const { course, teacherUser, studentUser } = await setupCourse();

    // Đáp án đúng bị đánh nhầm sang "Sai" (option thứ 2).
    const { questionId } = await questions.create(
      teacherUser,
      { courseId: course.id },
      {
        type: 'MULTIPLE_CHOICE_SINGLE',
        content: '2 + 2 = 4?',
        points: 2,
        options: [
          { content: 'Đúng', isCorrect: false },
          { content: 'Sai', isCorrect: true },
        ],
      }
    );

    const quiz = await testPrisma.quiz.create({
      data: {
        courseId: course.id,
        title: 'Quiz 1',
        status: 'PUBLISHED',
        createdBy: teacherUser.id,
        questions: { create: { questionId, position: 0 } },
      },
    });

    const optionsBefore = await testPrisma.questionOption.findMany({
      where: { questionId },
      orderBy: { position: 'asc' },
    });

    const { attemptId } = await attempts.start(studentUser, quiz.id);
    await attempts.saveAnswer(studentUser, attemptId, {
      questionId,
      type: 'MCQ',
      selectedOptionIds: [optionsBefore[0]!.id],
    });
    await attempts.submit(studentUser, attemptId);

    const wrongAttempt = await testPrisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    expect(wrongAttempt.score).toBe(0); // bị chấm sai vì đáp án nhập nhầm

    // Giáo viên sửa lại: "Đúng" mới là đáp án đúng.
    const result = await questions.update(teacherUser, questionId, {
      type: 'MULTIPLE_CHOICE_SINGLE',
      content: '2 + 2 = 4?',
      points: 2,
      options: [
        { content: 'Đúng', isCorrect: true },
        { content: 'Sai', isCorrect: false },
      ],
    });
    expect(result.regradedAttempts).toBe(1);

    // Id các option giữ nguyên → lựa chọn đã lưu vẫn trỏ đúng chỗ.
    const optionsAfter = await testPrisma.questionOption.findMany({
      where: { questionId },
      orderBy: { position: 'asc' },
    });
    expect(optionsAfter.map((o) => o.id)).toEqual(optionsBefore.map((o) => o.id));

    const answer = await testPrisma.answer.findFirstOrThrow({ where: { attemptId, questionId } });
    expect(JSON.parse(answer.selectedOptionIds!)).toEqual([optionsBefore[0]!.id]);
    expect(answer.isCorrect).toBe(true);
    expect(answer.score).toBe(2);

    const regraded = await testPrisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(regraded.score).toBe(2);
    expect(regraded.maxScore).toBe(2);
    expect(regraded.status).toBe('GRADED');
  });

  it('sửa nội dung đề bài không làm mất bài làm đã nộp', async () => {
    const { course, teacherUser, studentUser } = await setupCourse();

    const { questionId } = await questions.create(
      teacherUser,
      { courseId: course.id },
      {
        type: 'MULTIPLE_CHOICE_SINGLE',
        content: 'Thủ đô của Việt Nam là?',
        points: 1,
        options: [
          { content: 'Hà Nộii', isCorrect: true },
          { content: 'Huế', isCorrect: false },
        ],
      }
    );

    const quiz = await testPrisma.quiz.create({
      data: {
        courseId: course.id,
        title: 'Quiz 2',
        status: 'PUBLISHED',
        createdBy: teacherUser.id,
        questions: { create: { questionId, position: 0 } },
      },
    });

    const opts = await testPrisma.questionOption.findMany({
      where: { questionId },
      orderBy: { position: 'asc' },
    });
    const { attemptId } = await attempts.start(studentUser, quiz.id);
    await attempts.saveAnswer(studentUser, attemptId, {
      questionId,
      type: 'MCQ',
      selectedOptionIds: [opts[0]!.id],
    });
    await attempts.submit(studentUser, attemptId);

    // Chỉ sửa lỗi chính tả ở đề bài và đáp án.
    await questions.update(teacherUser, questionId, {
      type: 'MULTIPLE_CHOICE_SINGLE',
      content: 'Thủ đô của Việt Nam là thành phố nào?',
      points: 1,
      options: [
        { content: 'Hà Nội', isCorrect: true },
        { content: 'Huế', isCorrect: false },
      ],
    });

    const answer = await testPrisma.answer.findFirstOrThrow({ where: { attemptId, questionId } });
    const selected = JSON.parse(answer.selectedOptionIds!) as string[];
    expect(selected).toEqual([opts[0]!.id]);
    expect(answer.isCorrect).toBe(true);
    expect(answer.score).toBe(1);

    // Điểm mấu chốt: id học sinh đã chọn vẫn phải là một đáp án có thật của câu hỏi.
    // Trước đây option bị xoá rồi tạo lại nên id này thành mồ côi và bài làm hiển
    // thị như chưa chọn gì.
    const stillExists = await testPrisma.questionOption.findUnique({
      where: { id: selected[0]! },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists!.questionId).toBe(questionId);
    expect(stillExists!.content).toBe('Hà Nội');
  });
});
