// Centralized mapping for question types — used by quiz builder, question bank,
// quiz detail, preview, and taker so labels/colours/icons stay in sync when
// adding new types.

import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  CheckSquare,
  ToggleLeft,
  ListChecks,
  PenLine,
  Code,
  Braces,
  Globe,
  ArrowDownUp,
  PenSquare,
  Bug,
} from 'lucide-react';

export const QUESTION_TYPE_BADGE: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  MULTIPLE_CHOICE_MULTIPLE: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  TRUE_FALSE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  TRUE_FALSE_MULTI: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  ESSAY: 'bg-green-500/10 text-green-700 dark:text-green-400',
  CODE_PYTHON: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  CODE_CPP: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  CODE_WEB: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  PARSONS: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
  CODE_FILL: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  CODE_DEBUG_PYTHON: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  CODE_DEBUG_CPP: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
};

export const QUESTION_TYPE_SHORT: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'TN-1',
  MULTIPLE_CHOICE_MULTIPLE: 'TN-N',
  TRUE_FALSE: 'Đ/S',
  TRUE_FALSE_MULTI: 'Đ/S+',
  ESSAY: 'TL',
  CODE_PYTHON: 'PY',
  CODE_CPP: 'C++',
  CODE_WEB: 'Web',
  PARSONS: 'Sắp',
  CODE_FILL: 'Điền',
  CODE_DEBUG_PYTHON: 'Debug-PY',
  CODE_DEBUG_CPP: 'Debug-C++',
};

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm (1 đáp án)',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm (nhiều đáp án)',
  TRUE_FALSE: 'Đúng / Sai',
  TRUE_FALSE_MULTI: 'Đúng / Sai (nhiều phát biểu)',
  ESSAY: 'Tự luận',
  CODE_PYTHON: 'Code Python (tự chấm)',
  CODE_CPP: 'Code C++ (tự chấm)',
  CODE_WEB: 'Code Web (chấm tay)',
  PARSONS: 'Sắp xếp code (Parsons)',
  CODE_FILL: 'Điền vào chỗ trống',
  CODE_DEBUG_PYTHON: 'Debug Python',
  CODE_DEBUG_CPP: 'Debug C++',
};

export const QUESTION_TYPE_ICON: Record<string, LucideIcon> = {
  MULTIPLE_CHOICE_SINGLE: CheckCircle2,
  MULTIPLE_CHOICE_MULTIPLE: CheckSquare,
  TRUE_FALSE: ToggleLeft,
  TRUE_FALSE_MULTI: ListChecks,
  ESSAY: PenLine,
  CODE_PYTHON: Code,
  CODE_CPP: Braces,
  CODE_WEB: Globe,
  PARSONS: ArrowDownUp,
  CODE_FILL: PenSquare,
  CODE_DEBUG_PYTHON: Bug,
  CODE_DEBUG_CPP: Bug,
};
