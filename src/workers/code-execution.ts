/**
 * Worker process — chạy riêng biệt với lệnh:
 *   pnpm worker:dev
 *
 * Mỗi job nhận { submissionId }, lấy code từ DB,
 * gửi từng test case lên Judge0, lưu kết quả vào DB.
 */

import { config } from 'dotenv';
config();                                     // loads .env
config({ path: '.env.local', override: true }); // .env.local overrides .env (Next.js convention)
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  submitCode, waitForResult,
  LANGUAGE_ID, STATUS_ID,
  type Judge0Result,
} from '@/lib/judge0';
import { redisConnection, type CodeExecutionJobData } from '@/lib/queue';
import type { CodeLanguage, CodeSubmissionStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────

const LANG_MAP: Partial<Record<CodeLanguage, number>> = {
  PYTHON3:    LANGUAGE_ID.PYTHON3,
  JAVASCRIPT: LANGUAGE_ID.JAVASCRIPT,
  CPP17:      LANGUAGE_ID.CPP17,
};

function mapStatus(id: number): CodeSubmissionStatus {
  if (id === STATUS_ID.ACCEPTED)              return 'ACCEPTED';
  if (id === STATUS_ID.WRONG_ANSWER)          return 'WRONG_ANSWER';
  if (id === STATUS_ID.TIME_LIMIT_EXCEEDED)   return 'TIME_LIMIT';
  if (id === STATUS_ID.COMPILATION_ERROR)     return 'COMPILE_ERROR';
  if (id >= 7 && id <= 12)                    return 'RUNTIME_ERROR';
  return 'INTERNAL_ERROR';
}

// ── Worker ─────────────────────────────────────────────────────

const worker = new Worker<CodeExecutionJobData>(
  'code-execution',
  async (job) => {
    const { submissionId } = job.data;
    console.log(`[worker] Processing submission ${submissionId}`);

    const sub = await prisma.codeSubmission.findUnique({
      where:   { id: submissionId },
      include: {
        codeExercise: {
          include: { testCases: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!sub) { console.warn(`[worker] Submission ${submissionId} not found`); return; }

    const langId = LANG_MAP[sub.language];
    if (!langId) {
      await prisma.codeSubmission.update({
        where: { id: submissionId },
        data:  { status: 'MANUAL_REVIEW' },
      });
      return;
    }

    const { codeExercise } = sub;

    if (codeExercise.testCases.length === 0) {
      await prisma.codeSubmission.update({
        where: { id: submissionId },
        data:  { status: 'INTERNAL_ERROR' },
      });
      console.warn(`[worker] Submission ${submissionId}: exercise has no test cases`);
      return;
    }

    await prisma.codeSubmission.update({
      where: { id: submissionId },
      data:  { status: 'PROCESSING' },
    });

    let totalScore     = 0;
    let maxScore       = 0;
    let overallStatus: CodeSubmissionStatus = 'ACCEPTED';
    let compileError   = false;

    for (const tc of codeExercise.testCases) {
      maxScore += tc.points;

      if (compileError) {
        // All remaining test cases also fail with compile error
        await prisma.testCaseResult.create({
          data: { submissionId, testCaseId: tc.id, status: 'COMPILE_ERROR', score: 0 },
        });
        continue;
      }

      let result: Judge0Result;
      let token: string | null = null;
      try {
        token  = await submitCode({
          languageId:     langId,
          sourceCode:     sub.code,
          stdin:          tc.input,
          expectedOutput: tc.expectedOutput,
          cpuTimeLimit:   codeExercise.timeLimit,
          memoryLimit:    codeExercise.memoryLimit,
        });
        result = await waitForResult(token);
      } catch (err) {
        console.error(`[worker] Judge0 error on tc ${tc.id}:`, err);
        await prisma.testCaseResult.create({
          data: { submissionId, testCaseId: tc.id, status: 'INTERNAL_ERROR', judge0Token: token, score: 0 },
        });
        overallStatus = 'INTERNAL_ERROR';
        continue;
      }

      const tcStatus = mapStatus(result.status.id);
      const passed   = tcStatus === 'ACCEPTED';
      const tcScore  = passed ? tc.points : 0;
      totalScore += tcScore;

      await prisma.testCaseResult.create({
        data: {
          submissionId,
          testCaseId:    tc.id,
          status:        tcStatus,
          stdout:        result.stdout,
          stderr:        result.stderr,
          compileOutput: result.compile_output,
          time:          result.time  ? parseFloat(result.time) : null,
          memory:        result.memory,
          score:         tcScore,
          judge0Token:   token,
        },
      });

      if (tcStatus === 'COMPILE_ERROR') {
        compileError  = true;
        overallStatus = 'COMPILE_ERROR';
      } else if (!passed && overallStatus === 'ACCEPTED') {
        overallStatus = tcStatus;
      }
    }

    // Compute final overall status
    if (!compileError && overallStatus === 'ACCEPTED' && totalScore < maxScore) {
      overallStatus = 'PARTIAL';
    }

    await prisma.codeSubmission.update({
      where: { id: submissionId },
      data:  { status: overallStatus, score: totalScore, maxScore, gradedAt: new Date() },
    });

    console.log(`[worker] Done ${submissionId} → ${overallStatus} (${totalScore}/${maxScore})`);
  },
  { connection: redisConnection, concurrency: 3 },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

console.log('[worker] code-execution worker started');
