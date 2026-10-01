-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "antiCopyBlockPaste" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "antiCopyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "antiCopyWatermark" BOOLEAN NOT NULL DEFAULT true;

