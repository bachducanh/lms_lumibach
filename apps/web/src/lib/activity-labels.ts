import type { ActivityAction } from '@lumibach/db';

export const ACTION_LABELS: Record<ActivityAction, string> = {
  VIEW_COURSE: 'Course viewed',
  VIEW_LESSON: 'Lesson viewed',
  START_QUIZ: 'Quiz attempt started',
  SUBMIT_QUIZ: 'Quiz submitted',
  VIEW_ASSIGNMENT: 'Assignment viewed',
  SUBMIT_ASSIGNMENT: 'Assignment submitted',
  SUBMIT_CODE: 'Code submitted',
  VIEW_EXERCISE: 'Exercise viewed',
  LOGIN: 'User has logged in',
};

export const ACTION_LABELS_VI: Record<ActivityAction, string> = {
  VIEW_COURSE: 'Xem khóa học',
  VIEW_LESSON: 'Xem bài giảng',
  START_QUIZ: 'Bắt đầu làm quiz',
  SUBMIT_QUIZ: 'Nộp quiz',
  VIEW_ASSIGNMENT: 'Xem bài tập',
  SUBMIT_ASSIGNMENT: 'Nộp bài tập',
  SUBMIT_CODE: 'Nộp bài code',
  VIEW_EXERCISE: 'Xem bài code',
  LOGIN: 'Đăng nhập',
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  system: 'System',
  course: 'Course',
  lesson: 'Lesson',
  assignment: 'Assignment',
  quiz: 'Quiz',
  exercise: 'Code exercise',
  scratch: 'Scratch exercise',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action as ActivityAction] ?? action;
}

export function getActionLabelVi(action: string): string {
  return ACTION_LABELS_VI[action as ActivityAction] ?? action;
}

export function getComponentLabel(resourceType: string | null | undefined, action?: string) {
  if (action === 'LOGIN') return 'System';
  if (!resourceType) return 'System';
  return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType;
}

export function getEventContext(
  resourceName: string | null | undefined,
  courseName: string | null | undefined,
  resourceType: string | null | undefined
) {
  if (resourceName) return resourceName;
  if (courseName) return courseName;
  if (resourceType) return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType;
  return 'System';
}

export function describeActivityLog(params: {
  userName?: string | null;
  userId?: string | null;
  action: string;
  resourceName?: string | null;
  courseName?: string | null;
  resourceType?: string | null;
}) {
  const actor = params.userName || (params.userId ? `User ${params.userId}` : 'The user');
  const target = getEventContext(params.resourceName, params.courseName, params.resourceType);

  switch (params.action) {
    case 'LOGIN':
      return `${actor} logged in.`;
    case 'VIEW_COURSE':
    case 'VIEW_LESSON':
    case 'VIEW_ASSIGNMENT':
    case 'VIEW_EXERCISE':
      return `${actor} viewed ${target}.`;
    case 'START_QUIZ':
      return `${actor} started ${target}.`;
    case 'SUBMIT_QUIZ':
    case 'SUBMIT_ASSIGNMENT':
    case 'SUBMIT_CODE':
      return `${actor} submitted ${target}.`;
    default:
      return `${actor} performed ${getActionLabel(params.action)} on ${target}.`;
  }
}
