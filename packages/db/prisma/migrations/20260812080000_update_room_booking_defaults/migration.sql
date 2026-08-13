ALTER TABLE "RoomBookingSetting"
  ALTER COLUMN "maxDurationMinutes" SET DEFAULT 300,
  ALTER COLUMN "allowWeekend" SET DEFAULT true;

UPDATE "RoomBookingSetting"
SET
  "maxDurationMinutes" = 300,
  "allowWeekend" = true
WHERE "roomId" IS NULL;
