/**
 * Một hoạt động được soạn ở hai nơi, và các trình soạn dùng chung cho cả hai:
 *   - `course` — trong một khoá học (đường cũ)
 *   - `bank`   — bản mẫu trong ngân hàng nội dung của một danh mục
 *
 * Khác nhau ở ba chỗ, và chỉ ba chỗ: đường quay lại, đường sau khi lưu, và
 * những trường chỉ có nghĩa với một lớp (hạn nộp, đăng bài cho học sinh) thì
 * bản mẫu không hiện. Phần soạn nội dung giống hệt nhau — đó là lý do dùng
 * chung component thay vì dựng bản thứ hai cho kho.
 */
export type ActivityOwner =
  | { kind: 'course'; courseSlug: string; courseId: string }
  | { kind: 'bank'; categoryId: string };

/** Trang kho nội dung của một danh mục — chỗ quay về của mọi trình soạn bản mẫu. */
export function bankContentHref(categoryId: string): string {
  return `/question-banks/${categoryId}/content`;
}

/** Nhãn tiếng Việt cho từng loại hoạt động, dùng ở kho và ở trang Chương. */
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  LESSON: 'Bài giảng',
  ASSIGNMENT: 'Bài tập',
  QUIZ: 'Trắc nghiệm',
  CODE_EXERCISE: 'Bài code',
  PRACTICE_TEST: 'Đề luyện tập',
  FORUM: 'Diễn đàn',
  FILE: 'Tệp',
  EXTERNAL_URL: 'Liên kết',
};

/**
 * Đường tới trình soạn của một hoạt động trong kho.
 *
 * `null` nghĩa là loại đó không soạn được ở kho (FILE / EXTERNAL_URL chỉ là một
 * đường dẫn gắn trên hoạt động của lớp, không có bản ghi nội dung riêng), hoặc
 * bản ghi nội dung đã mất — hiện ra thì cũng chỉ dẫn tới trang 404.
 */
export function bankEditorHref(
  categoryId: string,
  item: {
    type: string;
    lessonId: string | null;
    assignmentId: string | null;
    quizId: string | null;
    codeExerciseId: string | null;
    practiceTestId: string | null;
    forumId: string | null;
  },
  moduleId: string
): string | null {
  const base = bankContentHref(categoryId);
  switch (item.type) {
    case 'LESSON':
      return item.lessonId ? `${base}/lessons/${item.lessonId}/edit?module=${moduleId}` : null;
    case 'ASSIGNMENT':
      return item.assignmentId ? `${base}/assignments/${item.assignmentId}/edit` : null;
    case 'QUIZ':
      return item.quizId ? `${base}/quizzes/${item.quizId}/edit` : null;
    case 'CODE_EXERCISE':
      return item.codeExerciseId ? `${base}/exercises/${item.codeExerciseId}/edit` : null;
    case 'PRACTICE_TEST':
      return item.practiceTestId ? `${base}/practice-tests/${item.practiceTestId}/edit` : null;
    case 'FORUM':
      return item.forumId ? `${base}/forums/${item.forumId}/edit` : null;
    default:
      return null;
  }
}
