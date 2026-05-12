'use server';

import { auth } from '@/auth';
import { runCode, LANGUAGE_ID } from '@/lib/judge0';
import type { CodeLanguage } from '@lumibach/db';

const LANG_MAP: Partial<Record<CodeLanguage, number>> = {
  PYTHON3: LANGUAGE_ID.PYTHON3,
  JAVASCRIPT: LANGUAGE_ID.JAVASCRIPT,
  CPP17: LANGUAGE_ID.CPP17,
};

export type SandboxRunResult = {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  statusDesc: string;
  time: string | null;
  memory: number | null;
};

export async function runSandboxAction(
  code: string,
  language: CodeLanguage,
  stdin: string
): Promise<{ success: true; result: SandboxRunResult } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập.' };

  const langId = LANG_MAP[language];
  if (!langId) return { success: false, error: 'Ngôn ngữ không được hỗ trợ trong sandbox.' };

  try {
    const result = await runCode({
      languageId: langId,
      sourceCode: code,
      stdin: stdin || undefined,
      cpuTimeLimit: 10,
      memoryLimit: 262144,
    });

    return {
      success: true,
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
        compileOutput: result.compile_output,
        statusDesc: result.status.description,
        time: result.time,
        memory: result.memory,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi khi chạy code.' };
  }
}
