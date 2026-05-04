import type { ActivityAction } from '@prisma/client';

export const ACTION_LABELS: Record<ActivityAction, string> = {
  VIEW_COURSE:        'Truy cập khóa học',
  VIEW_LESSON:        'Xem bài giảng',
  START_QUIZ:         'Bắt đầu làm quiz',
  SUBMIT_QUIZ:        'Nộp quiz',
  VIEW_ASSIGNMENT:    'Xem bài tập',
  SUBMIT_ASSIGNMENT:  'Nộp bài tập',
  SUBMIT_CODE:        'Nộp bài code',
  VIEW_EXERCISE:      'Xem bài code',
  LOGIN:              'Đăng nhập',
};
