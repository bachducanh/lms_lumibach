'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { runCode } from '@/lib/judge0';
import { hasMinRole } from '@/lib/permissions';
import type { CodeLanguage, CodeSubmissionStatus, UserRole } from '@prisma/client';

// ── Sandbox run ───────────────────────────────────────────────

type RunResult =
  | { success: true;  status: { id: number; description: string }; stdout: string | null; stderr: string | null; compileOutput: string | null; time: string | null; memory: number | null }
  | { success: false; error: string };

export async function runCodeAction(
  languageId: number,
  sourceCode: string,
  stdin: string,
): Promise<RunResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Chưa đăng nhập' };
  if (!sourceCode.trim()) return { success: false, error: 'Code trống' };
  try {
    const result = await runCode({ languageId, sourceCode, stdin: stdin.trim() || undefined });
    return { success: true, status: result.status, stdout: result.stdout, stderr: result.stderr, compileOutput: result.compile_output, time: result.time, memory: result.memory };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi không xác định' };
  }
}

// ── Teacher: upsert CodeAssignment config ─────────────────────
// NOTE: CodeAssignment model chưa có trong schema — placeholder cho tính năng tương lai

type CodeAssignmentInput = {
  language:     CodeLanguage;
  starterCode:  string;
  solutionCode: string;
  timeLimit:    number;
  memoryLimit:  number;
};

type ActionResult = { success: true; message: string } | { success: false; error: string };

export async function upsertCodeAssignmentAction(
  _assignmentId: string,
  _data: CodeAssignmentInput,
): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };
  return { success: false, error: 'Tính năng code assignment chưa được triển khai' };
}

// ── Teacher: save test cases ──────────────────────────────────

type TestCaseInput = {
  id?:            string;
  label?:         string | null;
  input:          string;
  expectedOutput: string;
  isHidden:       boolean;
  points:         number;
  position:       number;
};

export async function saveTestCasesAction(
  _codeAssignmentId: string,
  _testCases: TestCaseInput[],
): Promise<ActionResult> {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) return { success: false, error: 'Không có quyền' };
  return { success: false, error: 'Tính năng code assignment chưa được triển khai' };
}

// ── Teacher: get CodeAssignment (for setup panel) ─────────────

type CodeAssignmentData = {
  id:           string;
  language:     CodeLanguage;
  starterCode:  string | null;
  solutionCode: string | null;
  timeLimit:    number;
  memoryLimit:  number;
  testCases:    { id?: string; label: string | null; input: string; expectedOutput: string; isHidden: boolean; points: number; position: number }[];
} | null;

export async function getCodeAssignmentAction(_assignmentId: string): Promise<CodeAssignmentData> {
  return null;
}

// ── Student: run against visible test cases ───────────────────

type SampleResult = {
  testCaseId: string;
  label:      string | null;
  input:      string;
  expected:   string;
  status:     CodeSubmissionStatus;
  stdout:     string | null;
  stderr:     string | null;
  compileOut: string | null;
  time:       string | null;
  memory:     number | null;
  passed:     boolean;
};

export async function runSampleTestsAction(
  _assignmentId: string,
  _code: string,
  _language: CodeLanguage,
): Promise<{ success: true; results: SampleResult[] } | { success: false; error: string }> {
  return { success: false, error: 'Tính năng code assignment chưa được triển khai' };
}

// ── Student: submit (queued) ───────────────────────────────────

export async function submitCodeAssignmentAction(
  _assignmentId: string,
  _code: string,
  _language: CodeLanguage,
): Promise<{ success: true; submissionId: string } | { success: false; error: string }> {
  return { success: false, error: 'Tính năng code assignment chưa được triển khai' };
}

// ── Poll submission status ─────────────────────────────────────

export async function getCodeSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user) return null;

  return prisma.codeSubmission.findUnique({
    where:   { id: submissionId },
    include: {
      results: {
        include: { testCase: { select: { label: true, position: true, isHidden: true, points: true } } },
        orderBy: { testCase: { position: 'asc' } },
      },
    },
  });
}

// ── List student's submissions ─────────────────────────────────

export async function listMyCodeSubmissionsAction(_assignmentId: string): Promise<
  { id: string; status: CodeSubmissionStatus; score: number | null; maxScore: number | null; submittedAt: Date; attemptNumber: number }[]
> {
  return [];
}


