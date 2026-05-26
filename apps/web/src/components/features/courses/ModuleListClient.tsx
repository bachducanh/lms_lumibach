'use client';

import nextDynamic from 'next/dynamic';
import type { ModuleWithItems } from '@lumibach/types';

type Props = {
  courseSlug: string;
  courseId: string;
  modules: ModuleWithItems[];
  canManage: boolean;
  completedIds?: Set<string>;
  submittedAssignmentIds?: Set<string>;
  submittedQuizIds?: Set<string>;
  submittedPracticeTestIds?: Set<string>;
  submittedCodeExerciseIds?: Set<string>;
};

const ModuleList = nextDynamic(
  () => import('./ModuleList').then((m) => ({ default: m.ModuleList })),
  { ssr: false }
);

export function ModuleListClient(props: Props) {
  return <ModuleList {...props} />;
}
