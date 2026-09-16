-- AlterEnum
-- Adds SHORT_ANSWER: câu trả lời ngắn (học sinh gõ đáp án, hệ thống so với danh
-- sách đáp án chấp nhận được lưu trong QuestionOption).
-- Additive only — safe to run on a populated database (Postgres 12+ allows ADD VALUE in a tx
-- as long as the new value isn't used within the same transaction, which it isn't here).
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'SHORT_ANSWER';
