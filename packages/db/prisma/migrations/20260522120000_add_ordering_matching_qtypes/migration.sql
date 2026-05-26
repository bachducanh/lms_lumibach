-- AlterEnum
-- Adds two new question types: ORDERING (general drag-to-order) and MATCHING (drag-to-pair).
-- Additive only — safe to run on a populated database (Postgres 12+ allows ADD VALUE in a tx
-- as long as the new value isn't used within the same transaction, which it isn't here).
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'ORDERING';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'MATCHING';
