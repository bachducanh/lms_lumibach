-- AlterTable: User - thêm các field còn thiếu theo DATABASE_SCHEMA.md
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "avatarUrl",
  DROP COLUMN IF EXISTS "displayName",
  ADD COLUMN IF NOT EXISTS "username"     TEXT,
  ADD COLUMN IF NOT EXISTS "fullName"     TEXT,
  ADD COLUMN IF NOT EXISTS "avatar"       TEXT,
  ADD COLUMN IF NOT EXISTS "dateOfBirth"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loginCount"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "preferences"  JSONB;

-- CreateIndex: username unique + index
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");

-- AlterTable: AuditLog - align với DATABASE_SCHEMA.md
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "userRole" TEXT,
  ADD COLUMN IF NOT EXISTS "changes"  JSONB,
  ALTER COLUMN "resource" DROP NOT NULL;

-- DropIndex old: AuditLog_resource_idx (single col) → thay bằng composite
DROP INDEX IF EXISTS "AuditLog_resource_idx";

-- CreateIndex: composite index cho resource + resourceId
CREATE INDEX IF NOT EXISTS "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
