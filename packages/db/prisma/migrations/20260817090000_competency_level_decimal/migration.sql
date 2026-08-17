-- Cấp độ năng lực xuất phát/đích nhận số thập phân (vd 6.5).
--
-- INTEGER -> DOUBLE PRECISION là nới rộng kiểu: Postgres tự ép được, mọi giá
-- trị đang có giữ nguyên và không cần USING.
ALTER TABLE "CompetencyLevelTarget"
  ALTER COLUMN "startLevel" TYPE DOUBLE PRECISION,
  ALTER COLUMN "targetLevel" TYPE DOUBLE PRECISION;
